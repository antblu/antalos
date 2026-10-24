<?php
namespace Doctrine\ORM {
    // Minimal test double: no database is opened by this adapter contract test.
    interface EntityManagerInterface {
        public function getRepository($class);
        public function flush();
    }
}
namespace {
    require '/var/www/html/vendor/autoload.php';
    use LightSaml\Model\Assertion\Assertion;
    use LightSaml\Model\Assertion\Attribute;
    use LightSaml\Model\Assertion\AttributeStatement;
    use LightSaml\Model\Protocol\Response;
    use Mautic\UserBundle\Entity\Role;
    use Mautic\UserBundle\Entity\User;
    use Mautic\UserBundle\Security\SAML\User\UserMapper;

    $normal = (new Role())->setName('SSO Users')->setIsAdmin(false);
    $admin = (new Role())->setName('Administrator')->setIsAdmin(true);
    $existing = (new User())->setUsername('transaction-user');
    $em = new class($normal, $admin, $existing) implements \Doctrine\ORM\EntityManagerInterface {
        public function __construct(public $normal, public $admin, public $user) {}
        public function getRepository($class) {
            return new class($this, $class) {
                public function __construct(private $em, private $class) {}
                public function findOneBy($criteria, $order = null) {
                    return $this->class === User::class ? $this->em->user
                        : (($criteria['isAdmin'] ?? false) ? $this->em->admin : $this->em->normal);
                }
            };
        }
        public function flush() {}
    };
    $mapper = new UserMapper(['username' => 'username'], $em);
    function response(array $groups): Response {
        $statement = new AttributeStatement();
        $statement->addAttribute(new Attribute('username', ['transaction-user']));
        $statement->addAttribute(new Attribute('http://schemas.xmlsoap.org/claims/Group', $groups));
        $assertion = new Assertion();
        $assertion->addItem($statement);
        return (new Response())->addAssertion($assertion);
    }
    $mapper->getUsername(response(['mautic-users', 'mautic-admins']));
    if (!$existing->getRole()->isAdmin()) { throw new \RuntimeException('Admin grant failed'); }
    $mapper->getUsername(response(['mautic-users']));
    if ($existing->getRole()->isAdmin()) { throw new \RuntimeException('Admin removal failed'); }
    try {
        $mapper->getUsername(response([]));
        throw new \RuntimeException('Outsider accepted');
    } catch (\Symfony\Component\Security\Core\Exception\BadCredentialsException) {}
    echo "MAUTIC_ROLE_CHECK admin grant, removal and outsider denial passed\n";
}
