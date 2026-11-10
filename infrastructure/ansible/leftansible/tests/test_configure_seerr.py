import importlib.util
import json
from pathlib import Path
import tempfile
import sqlite3
import unittest
from unittest.mock import patch


SPEC = importlib.util.spec_from_file_location(
    "configure_seerr", Path(__file__).parents[1] / "scripts/configure-seerr.py"
)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class SeerrConfigurationTests(unittest.TestCase):
    def setUp(self):
        self.desired = {"application_url": "https://requests.example.com"}
        self.connections = {"jellyfin": {"ip": "jellyfin", "apiKey": "private"}}
        for name in ("radarr", "sonarr"):
            self.desired[name] = {"hostname": name}
            self.connections[name] = {"hostname": name, "apiKey": "private",
                                      "activeProfileId": 1, "activeDirectory": "/media"}
        self.settings = {"main": {"apiKey": "existing", "mediaServerType": 4},
                         "jellyfin": {"libraries": [{"id": "movies", "enabled": True}]},
                         "sessionSecret": "preserve", "public": {"initialized": False},
                         "sonarr": [], "radarr": [], "notifications": {"custom": True}}

    def test_connections_are_idempotent_and_preserve_state(self):
        result = MODULE.merge(self.settings, self.desired, self.connections)
        self.assertEqual(result, MODULE.merge(result, self.desired, self.connections))
        for key in ("sessionSecret", "public", "notifications"):
            self.assertEqual(result[key], self.settings[key])
        self.assertEqual(result["jellyfin"]["libraries"], self.settings["jellyfin"]["libraries"])
        self.assertEqual(result["main"]["apiKey"], "existing")
        self.assertEqual(result["main"]["mediaServerType"], 2)
        self.assertEqual(self.settings["radarr"], [])

    def test_updates_existing_default_without_removing_extra_servers(self):
        self.settings["radarr"] = [
            {"id": 7, "hostname": "old-name", "isDefault": True, "tags": [42]},
            {"id": 8, "hostname": "4k", "isDefault": True, "is4k": True},
        ]
        result = MODULE.merge(self.settings, self.desired, self.connections)
        self.assertEqual(len(result["radarr"]), 2)
        self.assertEqual(result["radarr"][0]["id"], 7)
        self.assertEqual(result["radarr"][0]["tags"], [42])
        self.assertEqual(result["radarr"][1], self.settings["radarr"][1])

    def test_ambiguous_defaults_fail(self):
        self.settings["sonarr"] = [
            {"id": 1, "hostname": "sonarr"},
            {"id": 2, "hostname": "other", "isDefault": True},
        ]
        with self.assertRaises(ValueError):
            MODULE.merge(self.settings, self.desired, self.connections)

    def test_atomic_write_keeps_backup_and_private_permissions(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "settings.json"
            path.write_text(json.dumps(self.settings))
            MODULE.apply(path, {"updated": True})
            self.assertEqual(json.loads(path.read_text()), {"updated": True})
            backup = path.with_name("settings.pre-ansible.json")
            self.assertEqual(json.loads(backup.read_text()), self.settings)
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)
            self.assertEqual(backup.stat().st_mode & 0o777, 0o600)

    def test_backend_failure_does_not_stop_seerr(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            (path / "settings.json").write_text(json.dumps(self.settings))
            (path / "connections.json").write_text(json.dumps(self.desired))
            container = {"State": {"Running": True}, "Mounts": [
                {"Destination": "/app/config", "Source": directory}]}
            with patch.object(MODULE, "inspect", return_value=container), \
                    patch.object(MODULE, "has_owner", return_value=True), \
                    patch.object(MODULE, "prepare", side_effect=ValueError("backend down")), \
                    patch.object(MODULE, "docker") as docker, \
                    patch("sys.argv", ["configure-seerr", str(path / "connections.json"), "--apply"]):
                with self.assertRaises(ValueError):
                    MODULE.main()
                docker.assert_not_called()
            self.assertEqual(json.loads((path / "settings.json").read_text()), self.settings)

    def test_no_owner_keeps_the_first_login_available(self):
        result = MODULE.merge(self.settings, self.desired, self.connections, owner_exists=False)
        self.assertEqual(result["main"]["mediaServerType"], 4)
        self.assertEqual(result["jellyfin"]["ip"], "")
        self.assertFalse(result["public"]["initialized"])
        self.assertEqual(result["jellyfin"]["apiKey"], "private")
        self.assertTrue(result["radarr"][0]["isDefault"])

    def test_owner_detection_reads_existing_database(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "db").mkdir()
            with sqlite3.connect(root / "db/db.sqlite3") as db:
                db.execute('CREATE TABLE "user" (id INTEGER)')
                self.assertFalse(MODULE.has_owner(root / "settings.json"))
                db.execute('INSERT INTO "user" VALUES (1)')
            self.assertTrue(MODULE.has_owner(root / "settings.json"))

    def test_http_failure_reports_status_without_credentials(self):
        with patch.object(MODULE, "docker", return_value=json.dumps(
                {"configurationError": True, "status": 401})):
            with self.assertRaises(MODULE.BackendError) as error:
                MODULE.fetch("http://jellyfin:8096/System/Info", "secret-token", jellyfin=True)
        self.assertIn("Jellyfin: HTTP 401", str(error.exception))
        self.assertNotIn("secret-token", str(error.exception))

    def test_jellyfin_uses_mediabrowser_authorization(self):
        with patch.object(MODULE, "docker", return_value='{"Id":"server"}') as docker:
            MODULE.fetch("http://jellyfin:8096/System/Info", "private-key", jellyfin=True)
        payload = json.loads(docker.call_args.kwargs["input"])
        self.assertEqual(payload["header"], "Authorization")
        self.assertEqual(payload["key"], 'MediaBrowser Token="private-key"')
        self.assertNotIn("private-key", str(docker.call_args.args))

    def test_arr_keeps_its_api_key_header(self):
        with patch.object(MODULE, "docker", return_value='[]') as docker:
            MODULE.fetch("http://sonarr:8989/api/v3/rootfolder", "private-key")
        payload = json.loads(docker.call_args.kwargs["input"])
        self.assertEqual(payload["header"], "X-Api-Key")
        self.assertEqual(payload["key"], "private-key")

    def test_revoked_saved_jellyfin_key_tries_corrected_protected_input(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            env = path / ".env"
            env.write_text("JELLYFIN_API_KEY=replacement\n")
            desired = {"jellyfin": {"hostname": "jellyfin", "port": 8096,
                                    "use_ssl": False, "external_url": "https://jellyfin",
                                    "library_names": ["Movies", "TV"]}}
            for service in ("radarr", "sonarr"):
                desired[service] = {"hostname": service, "port": 7878,
                                    "use_ssl": False, "external_url": "https://arr",
                                    "quality_profile": "Any", "root_folder": "/media"}
            (path / "config.xml").write_text("<Config><ApiKey>arr-private</ApiKey></Config>")
            replies = [MODULE.BackendError("Jellyfin", 401),
                       {"Id": "server", "ServerName": "Jellyfin"},
                       {"Items": [
                           {"Id": "movies", "Name": "Movies", "Type": "CollectionFolder", "CollectionType": "movies"},
                           {"Id": "tv", "Name": "TV", "Type": "CollectionFolder", "CollectionType": "tvshows"},
                           {"Id": "music", "Name": "Music", "Type": "CollectionFolder", "CollectionType": "music"}]},
                       [{"id": 1, "name": "Any"}], [{"path": "/media"}],
                       [{"id": 1, "name": "Any"}], [{"path": "/media"}]]
            self.settings["jellyfin"]["apiKey"] = "revoked"
            with patch.object(MODULE, "fetch", side_effect=replies) as fetch, \
                    patch.object(MODULE, "inspect"), \
                    patch.object(MODULE, "config_path", return_value=path):
                result = MODULE.prepare(desired, self.settings, env)
            self.assertEqual(result["jellyfin"]["apiKey"], "replacement")
            self.assertEqual([lib["name"] for lib in result["jellyfin"]["libraries"]], ["Movies", "TV"])
            self.assertTrue(all(lib["enabled"] for lib in result["jellyfin"]["libraries"]))
            self.assertEqual(fetch.call_args_list[0].args[1], "revoked")
            self.assertEqual(fetch.call_args_list[1].args[1], "replacement")


if __name__ == "__main__":
    unittest.main()
