<?php

// Mautic's early TrustMiddleware reads local.php before Symfony's env processors.
$file = '/var/www/html/config/local.php';
require $file;
$proxies = json_decode(getenv('MAUTIC_TRUSTED_PROXIES') ?: '[]', true, 512, JSON_THROW_ON_ERROR);
if (!is_array($proxies) || !array_is_list($proxies)) {
    throw new RuntimeException('MAUTIC_TRUSTED_PROXIES must be a JSON list.');
}
$parameters['trusted_proxies'] = $proxies;
$temporary = $file.'.tmp';
file_put_contents($temporary, "<?php\n\$parameters = ".var_export($parameters, true).";\n", LOCK_EX);
rename($temporary, $file);
