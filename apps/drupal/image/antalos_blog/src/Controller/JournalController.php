<?php

namespace Drupal\antalos_blog\Controller;

use Drupal\Component\Utility\Html;
use Drupal\Component\Utility\Unicode;
use Drupal\Core\Cache\CacheableJsonResponse;
use Drupal\Core\Cache\CacheableMetadata;
use Drupal\Core\Controller\ControllerBase;
use Drupal\Core\Url;
use Drupal\node\NodeInterface;
use Symfony\Component\HttpFoundation\Request;

/**
 * Server-rendered journal and a bounded, access-aware discovery endpoint.
 */
final class JournalController extends ControllerBase {

  public function index(Request $request): array {
    [$data, $cache] = $this->listing($request);
    $build = [
      '#theme' => 'antalos_journal',
      '#articles' => $data['articles'],
      '#filters' => $data['filters'],
      '#total' => $data['total'],
      '#previous' => $data['previous'],
      '#next' => $data['next'],
      '#attached' => ['drupalSettings' => ['antalosJournal' => ['initial' => $data]]],
    ];
    $cache->applyTo($build);
    return $build;
  }

  public function articles(Request $request): CacheableJsonResponse {
    [$data, $cache] = $this->listing($request);
    $response = new CacheableJsonResponse($data);
    $response->addCacheableDependency($cache);
    return $response;
  }

  private function listing(Request $request): array {
    $input = $request->query->all();
    $q = is_string($input['q'] ?? NULL) ? mb_substr(trim($input['q']), 0, 120) : '';
    $tag = is_scalar($input['tag'] ?? NULL) ? max(0, (int) $input['tag']) : 0;
    $page = is_scalar($input['page'] ?? NULL) ? min(10000, max(0, (int) $input['page'])) : 0;
    $sort = ($input['sort'] ?? '') === 'oldest' ? 'oldest' : 'latest';
    $cache = (new CacheableMetadata())
      ->setCacheTags(['node_list', 'taxonomy_term_list', 'config:field.field.node.article.field_tags'])
      ->setCacheContexts(['url.query_args', 'user.permissions', 'user.node_grants:view', 'languages:language_content', 'languages:language_interface'])
      ->setCacheMaxAge(300);
    $storage = $this->entityTypeManager()->getStorage('node');
    $query = $storage->getQuery()->accessCheck(TRUE)->condition('type', 'article')->condition('status', 1);
    if (array_key_exists('ids', $input)) {
      $ids = is_string($input['ids']) ? array_slice(array_filter(array_map('intval', explode(',', $input['ids'])), static fn(int $id): bool => $id > 0), 0, 100) : [];
      $query->condition('nid', $ids ?: [0], 'IN');
    }
    // Title search avoids exposing restricted body fields through search matches.
    if ($q !== '') {
      $query->condition('title', $q, 'CONTAINS');
    }
    $fields = \Drupal::service('entity_field.manager')->getFieldDefinitions('node', 'article');
    if ($tag) {
      if (isset($fields['field_tags'])) {
        $query->condition('field_tags.target_id', $tag);
      }
      else {
        $query->condition('nid', 0);
      }
    }
    $total = (int) (clone $query)->count()->execute();
    $ids = $query->sort('created', $sort === 'oldest' ? 'ASC' : 'DESC')->sort('nid', 'DESC')->range($page * 12, 12)->execute();
    $articles = [];
    foreach ($storage->loadMultiple($ids) as $node) {
      $node = \Drupal::service('entity.repository')->getTranslationFromContext($node);
      $access = $node->access('view', NULL, TRUE);
      $cache->addCacheableDependency($node)->addCacheableDependency($access);
      if ($access->isAllowed()) {
        $articles[] = self::card($node, $cache);
      }
    }
    $filters = compact('q', 'tag', 'page', 'sort');
    $topics = [];
    if (isset($fields['field_tags'])) {
      $termStorage = $this->entityTypeManager()->getStorage('taxonomy_term');
      $vocabularies = $fields['field_tags']->getSetting('handler_settings')['target_bundles'] ?? [];
      $termQuery = $termStorage->getQuery()->accessCheck(TRUE)->sort('name')->range(0, 50);
      if ($vocabularies) {
        $termQuery->condition('vid', array_values($vocabularies), 'IN');
      }
      foreach ($termStorage->loadMultiple($termQuery->execute()) as $term) {
        $access = $term->access('view', NULL, TRUE);
        $cache->addCacheableDependency($term)->addCacheableDependency($access);
        if ($access->isAllowed()) {
          $topics[] = ['id' => (int) $term->id(), 'label' => $term->label()];
        }
      }
    }
    $pageUrl = static fn(int $number): string => Url::fromRoute('antalos_blog.journal', [], ['query' => array_merge($filters, ['page' => $number])])->toString();
    return [[
      'articles' => $articles,
      'total' => $total,
      'filters' => $filters,
      'topics' => $topics,
      'previous' => $page > 0 ? $pageUrl($page - 1) : NULL,
      'next' => ($page + 1) * 12 < $total ? $pageUrl($page + 1) : NULL,
    ], $cache];
  }

  /**
   * Plain-text card data; never send raw authored HTML into React.
   */
  public static function card(NodeInterface $node, CacheableMetadata $cache): array {
    $cache->addCacheableDependency($node);
    $text = '';
    $summary = '';
    if ($node->hasField('body')) {
      $body = $node->get('body');
      $access = $body->access('view', NULL, TRUE);
      $cache->addCacheableDependency($access);
      if ($access->isAllowed()) {
        $text = trim(Html::decodeEntities(strip_tags($body->value ?? '')));
        $summary = trim(Html::decodeEntities(strip_tags($body->summary ?: $text)));
      }
    }
    $tags = [];
    if ($node->hasField('field_tags')) {
      $field = $node->get('field_tags');
      $access = $field->access('view', NULL, TRUE);
      $cache->addCacheableDependency($access);
      if ($access->isAllowed()) {
        foreach ($field->referencedEntities() as $term) {
          $access = $term->access('view', NULL, TRUE);
          $cache->addCacheableDependency($term)->addCacheableDependency($access);
          if ($access->isAllowed()) {
            $tags[] = ['id' => (int) $term->id(), 'label' => $term->label(), 'url' => Url::fromRoute('antalos_blog.journal', [], ['query' => ['tag' => $term->id()]])->toString()];
          }
        }
      }
    }
    $image = NULL;
    if ($node->hasField('field_image') && !$node->get('field_image')->isEmpty()) {
      $field = $node->get('field_image');
      $access = $field->access('view', NULL, TRUE);
      $cache->addCacheableDependency($access);
      if ($access->isAllowed() && ($file = $field->entity)) {
        $cache->addCacheableDependency($file);
        // Private files must continue through Drupal's normal access pipeline.
        if (str_starts_with($file->getFileUri(), 'public://')) {
          $image = ['url' => \Drupal::service('file_url_generator')->generateString($file->getFileUri()), 'alt' => $field->alt ?? ''];
        }
      }
    }
    return [
      'id' => (int) $node->id(),
      'title' => $node->label(),
      'url' => $node->toUrl()->toString(),
      'summary' => Unicode::truncate($summary, 200, TRUE, TRUE),
      'date' => gmdate('Y-m-d\TH:i:s\Z', $node->getCreatedTime()),
      'dateLabel' => \Drupal::service('date.formatter')->format($node->getCreatedTime(), 'custom', 'M j, Y', 'UTC'),
      'minutes' => max(1, (int) ceil(count(preg_split('/\s+/u', $text, -1, PREG_SPLIT_NO_EMPTY)) / 220)),
      'tags' => $tags,
      'image' => $image,
    ];
  }

}
