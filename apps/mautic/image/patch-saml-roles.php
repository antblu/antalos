<?php
// Guarded integration patch for the pinned upstream Mautic SAML adapter.
// LightSAML validates the response before calling the username mapper.
$root = '/var/www/html/docroot/app/bundles/UserBundle/Security/SAML/User/';
function replaceOnce(string $source, string $before, string $after): string {
    if (1 !== substr_count($source, $before)) {
        throw new RuntimeException('Mautic SAML adapter changed; review role integration.');
    }
    return str_replace($before, $after, $source);
}
$file = $root.'UserMapper.php';
$source = file_get_contents($file);
$source = replaceOnce($source, 'private array $attributes,', 'private array $attributes,'."\n        private \\Doctrine\\ORM\\EntityManagerInterface \$entityManager,");
$source = replaceOnce($source, 'return $user->getUserIdentifier();', <<<'CODE'
$role = $this->getRole($response);
        $existing = $this->entityManager->getRepository(User::class)->findOneBy(['username' => $user->getUserIdentifier()]);
        $existing ??= $this->entityManager->getRepository(User::class)->findOneBy(['email' => $user->getUserIdentifier()]);
        if ($existing) {
            $existing->setRole($role);
            $this->entityManager->flush();
        }
        return $user->getUserIdentifier();
CODE);
$source = replaceOnce($source, '    private function setValuesFromAssertion', <<<'CODE'
    public function getRole(Response $response): \Mautic\UserBundle\Entity\Role
    {
        $groups = [];
        foreach ($response->getAllAssertions() as $assertion) {
            foreach ($assertion->getAllAttributeStatements() as $statement) {
                $attribute = $statement->getFirstAttributeByName('http://schemas.xmlsoap.org/claims/Group');
                if ($attribute) {
                    $groups = array_merge($groups, $attribute->getAllAttributeValues() ?? []);
                }
            }
        }
        if (!in_array('mautic-users', $groups, true)) {
            throw new \Symfony\Component\Security\Core\Exception\BadCredentialsException('Application membership is required.');
        }
        $repository = $this->entityManager->getRepository(\Mautic\UserBundle\Entity\Role::class);
        $role = in_array('mautic-admins', $groups, true)
            ? $repository->findOneBy(['isAdmin' => true], ['id' => 'ASC'])
            : $repository->findOneBy(['name' => 'SSO Users', 'isAdmin' => false]);
        if (!$role) {
            throw new \Symfony\Component\Security\Core\Exception\BadCredentialsException('Application role is missing.');
        }
        return $role;
    }

    private function setValuesFromAssertion
CODE);
file_put_contents($file, $source);
$file = $root.'UserCreator.php';
$source = replaceOnce(file_get_contents($file), '$user->setRole($defaultRole);', '$user->setRole($this->userMapper->getRole($response));');
file_put_contents($file, $source);
