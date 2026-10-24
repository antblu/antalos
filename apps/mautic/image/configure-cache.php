<?php

// SAML request correlation uses Mautic's application cache, not PHP sessions.
// Run during installation or once against an existing shared NFS configuration.
$file = '/var/www/html/config/local.php';
require $file;
$host = getenv('MAUTIC_REDIS_HOST');
$password = getenv('REDIS_PASSWORD');
if (!$host || !$password) {
    throw new RuntimeException('Mautic Redis host and password are required.');
}
$parameters['cache_adapter'] = 'mautic.cache.adapter.redis';
$parameters['cache_adapter_tag_aware'] = 'mautic.cache.adapter.redis_tag_aware';
$parameters['cache_prefix'] = 'mautic_cache';
$parameters['cache_adapter_redis'] = [
    // Explicit endpoints avoid Mautic resolving a single Service into a nested
    // parameter array that Predis 3 interprets as an unconfigured cluster.
    'dsn' => ['redis://'.$host.':6379'],
    'options' => [
        'parameters' => [
            'password' => $password,
            // Keep application cache separate from PHP sessions in database 0.
            'database' => 1,
            'timeout' => 5,
            'read_write_timeout' => 5,
        ],
    ],
];
$temporary = $file.'.cache.tmp';
if (false === file_put_contents($temporary, "<?php\n\$parameters = ".var_export($parameters, true).";\n", LOCK_EX)) {
    throw new RuntimeException('Cannot write shared cache configuration.');
}
chmod($temporary, 0640);
if (!rename($temporary, $file)) {
    throw new RuntimeException('Cannot replace Mautic configuration.');
}
echo "Configured shared Redis application cache in database 1.\n";
