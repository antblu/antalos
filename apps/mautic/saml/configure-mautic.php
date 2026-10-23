<?php

// Run in the Mautic container with the downloaded Authentik metadata path.
// local.php is shared NFS state; preserve all unrelated settings and secrets.
chdir('/var/www/html');
require_once 'vendor/autoload.php';
$application = require 'docroot/app/console-application.php';
$kernel = $application->getKernel();
$kernel->boot();
$em = $kernel->getContainer()->get('doctrine')->getManager();
$role = $em->getRepository(\Mautic\UserBundle\Entity\Role::class)->findOneBy(['name' => 'SSO Users']);
if (!$role) {
    $role = new \Mautic\UserBundle\Entity\Role();
    $role->setName('SSO Users');
    $role->setDescription('SAML users; an administrator grants application permissions.');
    $role->setIsAdmin(false);
    $em->persist($role);
    $em->flush();
}
if ($role->isAdmin()) {
    throw new RuntimeException('SSO Users must be a non-admin role.');
}
$metadata = file_get_contents($argv[1]);
$document = new DOMDocument();
if (!$document->loadXML($metadata, LIBXML_NONET)) {
    throw new RuntimeException('Invalid IdP metadata.');
}
$xpath = new DOMXPath($document);
$xpath->registerNamespace('md', 'urn:oasis:names:tc:SAML:2.0:metadata');
if (!$xpath->query('/md:EntityDescriptor/md:IDPSSODescriptor/md:KeyDescriptor')->length) {
    throw new RuntimeException('Metadata must include the IdP signing certificate.');
}
$file = '/var/www/html/config/local.php';
require $file;
$parameters['site_url'] = rtrim(getenv('MAUTIC_URL'), '/');
// This setting is Mautic's own SP entity ID, despite the misleading idp name.
$parameters['saml_idp_entity_id'] = $parameters['site_url'];
$parameters['saml_idp_metadata'] = base64_encode($metadata);
foreach (['email', 'username', 'firstname', 'lastname'] as $field) {
    $parameters['saml_idp_'.$field.'_attribute'] = $field;
}
$parameters['saml_idp_default_role'] = $role->getId();
$temporary = $file.'.saml.tmp';
if (false === file_put_contents($temporary, "<?php\n\$parameters = ".var_export($parameters, true).";\n", LOCK_EX)) {
    throw new RuntimeException('Cannot write SAML configuration.');
}
chmod($temporary, 0640);
if (!rename($temporary, $file)) {
    throw new RuntimeException('Cannot replace SAML configuration.');
}
echo "Configured SAML with non-admin SSO Users role.\n";
