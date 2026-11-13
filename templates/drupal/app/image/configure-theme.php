<?php

use Drupal\block\Entity\Block;
use Drupal\Core\DrupalKernel;
use Symfony\Component\HttpFoundation\Request;

chdir('/opt/drupal/web');
$loader = require '/opt/drupal/vendor/autoload.php';
$request = Request::create('https://' . getenv('DRUPAL_HOST') . '/');
$kernel = DrupalKernel::createFromRequest($request, $loader, 'prod');
$kernel->boot();
$kernel->preHandle($request);

// Runs after the new web replicas are healthy: old images lack this theme.
\Drupal::service('theme_installer')->install(['antalos_journal']);
$state = \Drupal::state();
if (!$state->get('antalos_journal.configured', FALSE)) {
  $state->set('antalos_journal.previous_theme', \Drupal::config('system.theme')->get('default'));
  $state->set('antalos_journal.previous_front', \Drupal::config('system.site')->get('page.front'));
  // Theme installation may clone the old theme's block placements. Start with
  // one explicit set; disable copies rather than deleting their configuration.
  foreach (\Drupal::entityTypeManager()->getStorage('block')->loadByProperties(['theme' => 'antalos_journal']) as $block) {
    $block->disable()->save();
  }
  foreach ([
    'messages' => ['system_messages_block', 'highlighted', 0],
    'title' => ['page_title_block', 'content', -20],
    'tasks' => ['local_tasks_block', 'content', -10],
    'main' => ['system_main_block', 'content', 0],
    'help' => ['help_block', 'help', 0],
  ] as $id => [$plugin, $region, $weight]) {
    $definition = \Drupal::service('plugin.manager.block')->getDefinition($plugin);
    $block = Block::load('antalos_journal_' . $id) ?: Block::create([
      'id' => 'antalos_journal_' . $id,
      'theme' => 'antalos_journal',
      'plugin' => $plugin,
      'settings' => ['id' => $plugin, 'label' => $id, 'label_display' => FALSE, 'provider' => $definition['provider']],
    ]);
    $block->setRegion($region)->setWeight($weight)->enable()->save();
  }
  \Drupal::configFactory()->getEditable('system.theme')->set('default', 'antalos_journal')->save();
  \Drupal::configFactory()->getEditable('system.site')->set('page.front', '/journal')->save();
  $state->set('antalos_journal.configured', TRUE);
}
drupal_flush_all_caches();
echo "Journal theme configured; existing articles and later editorial settings preserved.\n";
