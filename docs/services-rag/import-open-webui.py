#!/usr/bin/env python3
"""Export the Services corpus or import it into a private Open WebUI knowledge base."""
import argparse
import hashlib
import json
import os
import re
import time
import uuid
from getpass import getpass
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
NAME = "Antblu Services"
DESCRIPTION = "Public services, package pricing, ownership, handoff, and project inquiries."


def documents():
    for line in (ROOT / "knowledge.jsonl").read_text(encoding="utf-8").splitlines():
        record = json.loads(line)
        if not re.fullmatch(r"[a-z0-9-]+", record["id"]):
            raise ValueError("Invalid record ID")
        content = "\n".join([
            record["title"], "", "Questions:", *record["questions"], "",
            record["text"], "", "Sources:", *record["source_urls"], "",
        ]).encode()
        yield f'{record["id"]}-{hashlib.sha256(content).hexdigest()[:12]}.txt', content


class OpenWebUI:
    def __init__(self, origin, token):
        self.origin = origin.rstrip("/")
        self.token = token

    def request(self, path, data=None, content_type="application/json"):
        if isinstance(data, dict):
            data = json.dumps(data).encode()
        headers = {"Content-Type": content_type}
        if self.token:
            headers["Authorization"] = "Bearer " + self.token
        try:
            with urlopen(Request(self.origin + path, data, headers), timeout=120) as response:
                return json.load(response)
        except HTTPError as error:
            raise RuntimeError(f"{path}: HTTP {error.code}") from None

    def sign_in(self, email, password):
        session = self.request("/api/v1/auths/signin", {"email": email, "password": password})
        self.token = session["token"]
        return session

    def knowledge(self):
        matches = []
        page = 1
        while True:
            params = urlencode({"query": NAME, "view_option": "created", "page": page})
            response = self.request("/api/v1/knowledge/search?" + params)
            matches.extend(item for item in response["items"] if item["name"] == NAME)
            if page * 30 >= response["total"]:
                break
            page += 1
        if len(matches) > 1:
            raise RuntimeError("Multiple knowledge bases have the same name.")
        return matches[0] if matches else self.request(
            "/api/v1/knowledge/create",
            {"name": NAME, "description": DESCRIPTION, "access_grants": []},
        )

    def linked_filenames(self, knowledge_id):
        filenames = []
        page = 1
        while True:
            result = self.request(f"/api/v1/knowledge/{knowledge_id}/files?page={page}")
            filenames.extend(item["filename"] for item in result["items"])
            if len(filenames) >= result["total"] or not result["items"]:
                return set(filenames)
            page += 1

    def upload(self, knowledge_id, name, content):
        boundary = uuid.uuid4().hex
        metadata = json.dumps({"knowledge_id": knowledge_id})
        prefix = (
            f'--{boundary}\r\nContent-Disposition: form-data; name="metadata"\r\n\r\n'
            f'{metadata}\r\n--{boundary}\r\n'
            f'Content-Disposition: form-data; name="file"; filename="{name}"\r\n'
            'Content-Type: text/plain\r\n\r\n'
        ).encode()
        data = prefix + content + f"\r\n--{boundary}--\r\n".encode()
        file = self.request("/api/v1/files/", data, f"multipart/form-data; boundary={boundary}")
        for _ in range(90):
            result = self.request(f'/api/v1/files/{file["id"]}/process/status')
            if result["status"] == "completed":
                return
            if result["status"] == "failed":
                break
            time.sleep(2)
        raise RuntimeError(f"Open WebUI did not complete indexing {name}.")


def import_corpus(client, collection):
    knowledge_id = collection["id"]
    existing = client.linked_filenames(knowledge_id)
    corpus = dict(documents())
    if existing - corpus.keys():
        raise RuntimeError("The knowledge base contains older or unrelated files. Review them before reimporting.")
    for name, content in corpus.items():
        if name not in existing:
            client.upload(knowledge_id, name, content)
            print(f"Indexed {name}", flush=True)
    if client.linked_filenames(knowledge_id) != corpus.keys():
        raise RuntimeError("Open WebUI did not link the complete corpus.")
    return knowledge_id


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--export", type=Path, help="write text files without connecting to Open WebUI")
    parser.add_argument("--origin", default="https://ai.antblu.net")
    parser.add_argument("--email", help="sign in with the supplied account and prompt for its password")
    args = parser.parse_args()
    if args.export:
        args.export.mkdir(parents=True, exist_ok=True)
        for name, content in documents():
            (args.export / name).write_bytes(content)
        return
    client = OpenWebUI(args.origin, os.environ.get("OPEN_WEBUI_API_KEY"))
    if args.email:
        client.sign_in(args.email, getpass("Open WebUI password: "))
    if not client.token:
        parser.error("Set OPEN_WEBUI_API_KEY or provide --email to sign in.")
    knowledge_id = import_corpus(client, client.knowledge())
    print(f"Verified knowledge base {knowledge_id}")


if __name__ == "__main__":
    main()
