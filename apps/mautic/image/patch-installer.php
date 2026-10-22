<?php

// Galera allocates non-contiguous IDs; the administrator role need not be ID 1.
$file = '/var/www/html/docroot/app/bundles/InstallBundle/Install/InstallService.php';
$source = file_get_contents($file);
$before = '$adminRole = $this->entityManager->getReference(Role::class, 1);';
$after = <<<'PHP'
$adminRole = $this->entityManager->getRepository(Role::class)->findOneBy(['isAdmin' => true], ['id' => 'ASC']);
            if (null === $adminRole) {
                throw new \RuntimeException('The installation administrator role is missing.');
            }
PHP;
if (1 !== substr_count($source, $before)) {
    throw new RuntimeException('Mautic installer changed; review the Galera role lookup patch.');
}
file_put_contents($file, str_replace($before, $after, $source));
