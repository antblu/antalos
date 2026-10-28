"""Exercise callback migration without requiring Authentik or a database."""
import ast
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path
from types import SimpleNamespace
import unittest


class RedirectURIMatchingMode(StrEnum):
    STRICT = 'strict'
    REGEX = 'regex'


@dataclass
class RedirectURI:
    # Match the pinned Authentik model's typed redirect entries.
    matching_mode: RedirectURIMatchingMode
    url: str
    redirect_uri_type: str = 'authorization'


source = Path(__file__).resolve().parents[1] / 'reconcile.py'
tree = ast.parse(source.read_text())
function = next(node for node in tree.body
                if isinstance(node, ast.FunctionDef) and node.name == 'ensure_argocd_callback')
namespace = {'RedirectURI': RedirectURI, 'RedirectURIMatchingMode': RedirectURIMatchingMode}
exec(compile(ast.Module(body=[function], type_ignores=[]), str(source), 'exec'), namespace)
migrate = namespace['ensure_argocd_callback']


class CallbackMigration(unittest.TestCase):
    def test_preserves_callbacks_and_credentials_and_is_idempotent(self):
        original = [RedirectURI(RedirectURIMatchingMode.STRICT,
                                'https://argo.example/api/dex/callback'),
                    RedirectURI(RedirectURIMatchingMode.REGEX,
                                r'http://localhost:8085/.*')]
        saves = []
        provider = SimpleNamespace(redirect_uris=original.copy(), client_id='existing-id',
                                   client_secret='fixture-only',
                                   save=lambda **kwargs: saves.append(kwargs))
        migrate(provider, 'argo.example')
        self.assertEqual(provider.redirect_uris[:2], original)
        self.assertEqual(provider.redirect_uris[2], RedirectURI(
            RedirectURIMatchingMode.STRICT, 'https://argo.example/auth/callback'))
        self.assertEqual(saves, [{'update_fields': ['redirect_uris']}])
        self.assertEqual((provider.client_id, provider.client_secret),
                         ('existing-id', 'fixture-only'))
        migrate(provider, 'argo.example')
        self.assertEqual(len(provider.redirect_uris), 3)
        self.assertEqual(len(saves), 1)

    def test_missing_host_leaves_provider_untouched(self):
        migrate(object(), None)


if __name__ == '__main__':
    unittest.main()
