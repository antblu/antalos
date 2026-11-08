import importlib.util
import json
from pathlib import Path
import tempfile
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
                    patch.object(MODULE, "prepare", side_effect=ValueError("backend down")), \
                    patch.object(MODULE, "docker") as docker, \
                    patch("sys.argv", ["configure-seerr", str(path / "connections.json"), "--apply"]):
                with self.assertRaises(ValueError):
                    MODULE.main()
                docker.assert_not_called()
            self.assertEqual(json.loads((path / "settings.json").read_text()), self.settings)


if __name__ == "__main__":
    unittest.main()
