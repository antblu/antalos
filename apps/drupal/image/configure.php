<?php

use Drupal\Core\DrupalKernel;
use Drupal\node\Entity\Node;
use Drupal\node\Entity\NodeType;
use Drupal\field\Entity\FieldStorageConfig;
use Drupal\field\Entity\FieldConfig;
use Drupal\filter\Entity\FilterFormat;
use Drupal\path_alias\Entity\PathAlias;
use Symfony\Component\HttpFoundation\Request;

chdir('/opt/drupal/web');
$loader = require '/opt/drupal/vendor/autoload.php';
$request = Request::create('https://' . getenv('DRUPAL_HOST') . '/');
$kernel = DrupalKernel::createFromRequest($request, $loader, 'prod');
$kernel->boot();
$kernel->preHandle($request);

\Drupal::service('module_installer')->install(['openid_connect', 'antalos_blog']);
// The module installer rebuilds the container; use the current services below.
\Drupal::configFactory()->getEditable('openid_connect.settings.generic')
  ->set('enabled', TRUE)
  // Credentials and endpoints are supplied only through settings.php overrides.
  ->set('settings', ['client_id' => '', 'client_secret' => '', 'authorization_endpoint' => '', 'token_endpoint' => '', 'userinfo_endpoint' => '', 'prompt' => []])
  ->save();
\Drupal::configFactory()->getEditable('openid_connect.settings')
  ->set('always_save_userinfo', TRUE)
  ->set('connect_existing_users', FALSE)
  ->set('override_registration_settings', TRUE)
  ->set('user_login_display', 'above')
  ->set('userinfo_mappings', ['timezone' => 'zoneinfo'])
  ->save();
\Drupal::configFactory()->getEditable('user.settings')
  ->set('register', 'admin_only')
  ->save();

// Standard-profile defaults can vary between core releases. Ensure the seeded
// article has a real bundle and body field before creating any content.
$type = NodeType::load('article');
if (!$type) {
  $type = NodeType::create(['type' => 'article', 'name' => 'Article', 'description' => 'Blog articles.']);
  $type->save();
}
if (!FieldStorageConfig::loadByName('node', 'body')) {
  FieldStorageConfig::create(['entity_type' => 'node', 'field_name' => 'body', 'type' => 'text_with_summary'])->save();
}
if (!FieldConfig::loadByName('node', 'article', 'body')) {
  FieldConfig::create(['entity_type' => 'node', 'field_name' => 'body', 'bundle' => 'article', 'label' => 'Body'])->save();
  $displays = \Drupal::service('entity_display.repository');
  $displays->getFormDisplay('node', 'article')->setComponent('body', ['type' => 'text_textarea_with_summary'])->save();
  $displays->getViewDisplay('node', 'article')->setComponent('body', ['type' => 'text_default', 'label' => 'hidden'])->save();
  $displays->getViewDisplay('node', 'article', 'teaser')->setComponent('body', ['type' => 'text_summary_or_trimmed', 'label' => 'hidden'])->save();
}
if (!FilterFormat::load('basic_html')) {
  FilterFormat::create([
    'format' => 'basic_html', 'name' => 'Basic HTML',
    'filters' => [
      'filter_html' => ['status' => TRUE, 'settings' => ['allowed_html' => '<p> <br> <a href> <em> <strong> <ul> <ol> <li>']],
      'filter_htmlcorrector' => ['status' => TRUE],
    ],
  ])->save();
}

$state = \Drupal::state();
if (!$state->get('antalos_blog.welcome_seeded', FALSE)) {
  $uuid = '766ce400-cef4-4cc6-9be7-5a180fe6e2c7';
  $storage = \Drupal::entityTypeManager()->getStorage('node');
  $existing = $storage->loadByProperties(['uuid' => $uuid]);
  $node = $existing ? reset($existing) : NULL;
  if (!$node) {
    $node = Node::create([
      'uuid' => $uuid,
      'type' => 'article',
      'title' => "Welcome to Antblu's Blog",
      'uid' => 1,
      'status' => 1,
      'promote' => 1,
      'sticky' => 1,
      'body' => [
        'format' => 'basic_html',
        'summary' => 'A new home for notes on self-hosting, homelab projects, Linux, and infrastructure.',
        'value' => file_get_contents('/usr/local/share/drupal/welcome.html'),
      ],
    ]);
    $node->save();
  }
  $path = '/node/' . $node->id();
  $aliases = \Drupal::entityTypeManager()->getStorage('path_alias')->loadByProperties(['alias' => '/welcome', 'langcode' => 'en']);
  if ($aliases) {
    $alias = reset($aliases);
    if ($alias->getPath() !== $path) {
      throw new RuntimeException('/welcome already belongs to another page; review before retrying.');
    }
  }
  else {
    PathAlias::create(['path' => $path, 'alias' => '/welcome', 'langcode' => 'en'])->save();
  }
  $state->set('antalos_blog.welcome_seeded', TRUE);
}
drupal_flush_all_caches();
echo "Authentik OIDC configured; welcome article seeded or preserved.\n";
