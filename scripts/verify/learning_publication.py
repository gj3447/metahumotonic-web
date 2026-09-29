#!/usr/bin/env python3
"""Independent public-graph verifier; stdlib only, no KG or resolver access.

Local: --dist dist [--source src/data/learning-hub.json]
Release host: --dist /release/html --artifact-only
Readback: --base-url https://host --expected-publication /release/html/learn/publication.json
Optional --receipt writes a new file exclusively; a receipt is not a signature.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from datetime import date, datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener

BASE = "https://metahumotonic.com/learn/"
FILES = ("index.html", "learn/index.html", "learn/data.json", "learn/graph.jsonld", "learn/usl.json")
RELATIONS = {
    "INTRODUCES": ({"article"}, {"concept", "project", "apostle"}),
    "DEFINES": ({"article"}, {"concept"}),
    "DOCUMENTED_IN": ({"concept", "project", "apostle", "article"}, {"article"}),
    "SOURCE_CODE": ({"project", "article"}, {"repository"}),
    "PUBLISHES": ({"channel"}, {"video"}),
    "EXPLORE_NEXT": ({"concept", "article", "project", "repository", "channel", "video", "apostle"}, {"concept", "article", "project", "repository", "channel", "video", "apostle"}),
}
LIMIT = 3 * 1024 * 1024


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def canonical(value) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode()


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def iri(identifier: str) -> str:
    return BASE + "#entity-" + identifier


def predicate(relation: str) -> str:
    return BASE + "#relation-" + relation.lower().replace("_", "-")


def public_url(value: str) -> bool:
    url = urlsplit(value)
    if url.scheme != "https" or url.netloc != url.hostname or url.geturl() != value:
        return False
    if url.hostname == "metahumotonic.com":
        path = bool(re.fullmatch(r"/(?:wiki/(?:axioms|authority|worldview|apostles(?:/[a-z0-9-]+)?)|projects(?:/[a-z0-9-]+)?|apostles(?:/[a-z0-9-]+)?|research/(?:hswm|lakatotree)|axioms|philosophy|agents|book|foundation|system)/", url.path)) or url.path == "/research/foundations.json"
        fragment = not url.fragment or (url.path in {"/axioms/", "/wiki/axioms/"} and bool(re.fullmatch(r"axiom-(?:[1-9]|1[0-2])", url.fragment)))
        return not url.query and path and fragment
    if url.fragment:
        return False
    if url.hostname == "github.com":
        return not url.query and (bool(re.fullmatch(r"/gj3447(?:/[A-Za-z0-9_.-]+)?", url.path)) or url.path == "/gj3447/metahumotonic-foundation/blob/master/CHARTER.md")
    if url.hostname == "www.youtube.com":
        return (not url.query and bool(re.fullmatch(r"/(?:@[A-Za-z0-9_.-]+(?:/videos)?|channel/UC[A-Za-z0-9_-]+)", url.path))) or (url.path == "/watch" and bool(re.fullmatch(r"v=[A-Za-z0-9_-]{11}", url.query)))
    return False


class Page(HTMLParser):
    def __init__(self, raw: bytes):
        super().__init__(convert_charrefs=True)
        self.ids: list[str] = []
        self.hrefs: set[str] = set()
        self.graphs: list[dict] = []
        self.script: list[str] | None = None
        self.feed(raw.decode("utf8"))

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if attributes.get("id"):
            self.ids.append(attributes["id"])
        if attributes.get("href"):
            self.hrefs.add(attributes["href"])
        if tag == "script" and attributes.get("type") == "application/ld+json":
            self.script = []

    def handle_data(self, value):
        if self.script is not None:
            self.script.append(value)

    def handle_endtag(self, tag):
        if tag == "script" and self.script is not None:
            self.graphs.append(json.loads("".join(self.script)))
            self.script = None


def verify(blobs: dict[str, bytes], manifest: dict, source: dict | None = None) -> dict:
    require(set(manifest) == {"schema", "sourceDigest", "files"}, "unexpected publication manifest fields")
    require(manifest["schema"] == "metahumotonic/hub-publication@1", "wrong publication schema")
    require(set(manifest["files"]) == set(FILES), "publication must bind all five surfaces")
    for name in FILES:
        require(0 < len(blobs[name]) <= LIMIT, "missing or oversized surface: " + name)
        require(sha(blobs[name]) == manifest["files"][name], "artifact digest mismatch: " + name)
    catalog = json.loads(blobs["learn/data.json"])
    ld = json.loads(blobs["learn/graph.jsonld"])
    usl = json.loads(blobs["learn/usl.json"])
    require(set(catalog) == {"schema", "edition", "publication", "nodes", "edges", "paths", "sourceDigest", "relationDescriptions"}, "unexpected catalog fields")
    require(catalog["schema"] == "metahumotonic/learning-hub@1" and catalog["publication"] == "curated-public", "wrong catalog scope")
    raw = {key: catalog[key] for key in ("schema", "edition", "publication", "nodes", "edges", "paths")}
    digest = "sha256:" + sha(canonical(raw))
    require(digest == catalog["sourceDigest"] == manifest["sourceDigest"] == ld["mh:sourceDigest"], "source digest mismatch")
    if source is not None:
        require(catalog == {key: value for key, value in source.items() if key not in {"jsonld", "usl"}}, "catalog differs from reviewed source")
        require(ld == source["jsonld"] and usl == source["usl"], "projection differs from reviewed source")
    require(set(catalog["relationDescriptions"]) == set(RELATIONS), "unknown relationship vocabulary")
    nodes = {node["id"]: node for node in catalog["nodes"]}
    require(0 < len(nodes) == len(catalog["nodes"]) <= 100, "duplicate or empty entity set")
    require(len({edge["id"] for edge in catalog["edges"]}) == len(catalog["edges"]) <= 300, "duplicate edge identity")
    require(len({path["id"] for path in catalog["paths"]}) == len(catalog["paths"]) <= 12, "duplicate path identity")
    edition = date.fromisoformat(catalog["edition"])
    require(all(node["public"] is True and date.fromisoformat(node["reviewedAt"]) <= edition for node in nodes.values()), "private or future-reviewed entity")
    for node in nodes.values():
        require(set(node) <= {"id", "kind", "title", "summary", "href", "public", "authority", "reviewedAt", "sources", "semanticType", "status"} and {"id", "kind", "title", "summary", "href", "public", "authority", "reviewedAt", "sources"} <= set(node), "unexpected entity fields")
        require(node["authority"] in {"PRIMARY_SOURCE", "EDITORIAL_SUMMARY"} and public_url(node["href"]), "invalid entity authority or locator")
        require(not node.get("semanticType") or node["semanticType"] in {"https://schema.org/AboutPage", "https://schema.org/DigitalDocument", "https://schema.org/Project", "https://schema.org/Report"}, "unknown semantic entity type")
        require(not node.get("status") or (isinstance(node["status"], str) and node["status"].strip()), "invalid entity status")
        require(0 < len(node["sources"]) <= 8 and len({item["url"] for item in node["sources"]}) == len(node["sources"]), "missing or duplicate evidence")
        require(all(set(item) == {"label", "url"} and public_url(item["url"]) for item in node["sources"]), "invalid public evidence")
        address = urlsplit(node["href"])
        if node["kind"] == "repository":
            require(address.hostname == "github.com" and len(address.path.split("/")) == 3, "repository must identify source code")
        elif node["kind"] in {"video", "channel"}:
            require(address.hostname == "www.youtube.com" and (address.path == "/watch" if node["kind"] == "video" else bool(re.fullmatch(r"/(?:@[A-Za-z0-9_.-]+|channel/UC[A-Za-z0-9_-]+)", address.path))), "wrong media locator kind")
        else:
            require(node["kind"] in {"concept", "article", "project", "apostle"} and (address.hostname == "metahumotonic.com" or (node["kind"] == "article" and address.hostname == "github.com" and address.path == "/gj3447/metahumotonic-foundation/blob/master/CHARTER.md")), "wrong public entity kind")
    for edge in catalog["edges"]:
        require(set(edge) == {"id", "from", "to", "relation", "label", "status", "authority", "source"} and public_url(edge["source"]), "invalid relationship fields or source")
        require(edge["authority"] in {"PRIMARY_SOURCE", "EDITORIAL_SUMMARY"}, "invalid relationship authority")
        roles = RELATIONS[edge["relation"]]
        require(edge["from"] in nodes and edge["to"] in nodes and edge["from"] != edge["to"], "invalid edge endpoints")
        require(nodes[edge["from"]]["kind"] in roles[0] and nodes[edge["to"]]["kind"] in roles[1], "wrong edge roles")
        require(edge["status"] in {"ACTIVE", "PROPOSED", "RETIRED"}, "unknown relationship status")
    for path in catalog["paths"]:
        require(0 < len(set(path["steps"])) == len(path["steps"]) <= 12 and all(step in nodes for step in path["steps"]), "invalid reading path")
    resources = {node["uid"]: node for node in usl["nodes"]}
    links = {edge["uid"]: edge for edge in usl["relations"]}
    require(len(resources) == len(usl["nodes"]) == len(nodes) and set(resources) == {iri(key) for key in nodes}, "USL entity identities differ")
    require(len(links) == len(usl["relations"]) == len(catalog["edges"]), "USL relationship identities differ")
    graph = {node["@id"]: node for node in ld["@graph"]}
    require(len(graph) == len(ld["@graph"]), "duplicate JSON-LD identity")
    require(ld["@id"] == BASE + "graph.jsonld", "wrong named graph identity")
    require(ld["@context"] == {"@version": 1.1, "skos": "http://www.w3.org/2004/02/skos/core#", "@vocab": "https://schema.org/", "mh": BASE + "#", "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#", "prov": "http://www.w3.org/ns/prov#"}, "JSON-LD context redefines the meaning contract")
    expected_ids = {BASE} | {iri(key) for key in nodes} | {BASE + "#edge-" + edge["id"] for edge in catalog["edges"]} | {BASE + "#path-" + path["id"] for path in catalog["paths"]} | {predicate(key) for key in RELATIONS}
    require(set(graph) == expected_ids, "JSON-LD graph membership differs")
    for node in nodes.values():
        entity = graph[iri(node["id"])]
        types = {"apostle": "DefinedTerm", "concept": "DefinedTerm", "article": "LearningResource", "project": "SoftwareApplication", "repository": "SoftwareSourceCode", "channel": "CollectionPage", "video": "VideoObject"}
        require(entity["@type"] == types[node["kind"]] and entity["mh:reviewedAt"] == node["reviewedAt"], "JSON-LD entity kind or review date changed")
        expected_properties = {"name": node["title"], "kind": node["kind"], "locator": node["href"], "authority": node["authority"]}
        if node.get("semanticType"):
            expected_properties["semanticType"] = node["semanticType"]
        if node.get("status"):
            expected_properties["status"] = node["status"]
        require(resources[iri(node["id"])]["properties"] == expected_properties, "USL representation changed")
        require(resources[iri(node["id"])]["properties"]["locator"] == entity["url"] == node["href"], "entity address changed")
        require(entity["name"] == node["title"] and entity["description"] == node["summary"] and entity["mh:authority"] == node["authority"], "entity representation changed")
        require(entity.get("additionalType") == node.get("semanticType") and entity.get("mh:status") == node.get("status"), "entity semantic type or status changed")
        require(entity["prov:wasDerivedFrom"] == [{"@id": source["url"]} for source in node["sources"]], "entity provenance changed")
        expected_about = [{"@id": iri(edge["to"])} for edge in catalog["edges"] if edge["from"] == node["id"] and edge["relation"] == "INTRODUCES" and edge["status"] == "ACTIVE"]
        require(entity.get("about", []) == expected_about, "standard about relation changed")
        if node["kind"] in {"concept", "apostle"}:
            require(entity["skos:prefLabel"] == {"@value": node["title"], "@language": "ko"}, "SKOS preferred label changed")
            if node["authority"] == "PRIMARY_SOURCE":
                require(entity["skos:definition"] == {"@value": node["summary"], "@language": "ko"}, "canonical SKOS definition changed")
            else:
                require("skos:definition" not in entity, "editorial summary was promoted to a canonical definition")
        for relation in RELATIONS:
            expected = [{"@id": iri(edge["to"])} for edge in catalog["edges"] if edge["from"] == node["id"] and edge["relation"] == relation and edge["status"] == "ACTIVE"]
            require(entity.get(predicate(relation), []) == expected, "active JSON-LD relationship changed")
    for edge in catalog["edges"]:
        identity = BASE + "#edge-" + edge["id"]
        statement, link = graph[identity], links[identity]
        require(statement["@type"] == "rdf:Statement" and statement["rdf:subject"]["@id"] == link["from_uid"] == iri(edge["from"]) and statement["rdf:object"]["@id"] == link["to_uid"] == iri(edge["to"]), "relationship direction changed")
        require(statement["rdf:predicate"]["@id"] == predicate(edge["relation"]) and link["type"] == edge["relation"], "relationship meaning changed")
        require(statement["mh:status"] == edge["status"] and statement["mh:authority"] == edge["authority"] and statement["prov:wasDerivedFrom"]["@id"] == edge["source"], "relationship provenance changed")
        require(statement["description"] == edge["label"], "relationship description changed")
        require(json.loads(link["properties"]["description"]) == {"label": edge["label"], "meaning": catalog["relationDescriptions"][edge["relation"]], "status": edge["status"], "authority": edge["authority"], "source": edge["source"]}, "USL meaning/provenance changed")
    for path in catalog["paths"]:
        items = graph[BASE + "#path-" + path["id"]]["itemListElement"]
        require(items == [{"@type": "ListItem", "position": index + 1, "item": {"@id": iri(step)}} for index, step in enumerate(path["steps"])], "reading order changed")
    home, learn = Page(blobs["index.html"]), Page(blobs["learn/index.html"])
    for page in (home, learn):
        require(len(page.ids) == len(set(page.ids)), "duplicate HTML anchor")
        require(ld in page.graphs, "HTML structured data differs from public graph")
    require("start" in home.ids and "/learn/" in home.hrefs, "home has no learning entrypoint")
    required_anchors = {"entity-" + key for key in nodes} | {"path-" + path["id"] for path in catalog["paths"]} | {"relation-" + key.lower().replace("_", "-") for key in RELATIONS}
    require(required_anchors <= set(learn.ids), "missing entity/path/vocabulary HTML anchor")
    for node in nodes.values():
        href = node["href"].removeprefix("https://metahumotonic.com") if node["href"].startswith("https://metahumotonic.com/") else node["href"]
        require(href in learn.hrefs, "missing rendered resource link")
    for edge in catalog["edges"]:
        if edge["status"] == "ACTIVE":
            require("edge-" + edge["id"] in learn.ids and "#entity-" + edge["to"] in learn.hrefs, "missing rendered relationship")
    return {"sourceDigest": digest, "nodes": len(nodes), "relations": len(catalog["edges"]), "surfaces": len(FILES), "files": manifest["files"]}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError("publication readback must not redirect")


def readback(base: str, manifest: dict) -> dict[str, bytes]:
    url = urlsplit(base)
    require(url.scheme in {"https", "http"} and bool(url.hostname) and not url.username and not url.password and url.path in {"", "/"} and not url.query and not url.fragment, "readback requires an explicit HTTP origin")
    opener = build_opener(ProxyHandler({}), NoRedirect())
    blobs = {}
    for name in FILES:
        mime = "text/html" if name.endswith(".html") else "application/ld+json" if name.endswith(".jsonld") else "application/json"
        with opener.open(Request(base.rstrip("/") + "/" + name.removesuffix("index.html"), headers={"Accept": mime}), timeout=8) as response:
            require(response.status == 200 and response.headers.get_content_type() == mime, "wrong HTTP status or MIME: " + name)
            blobs[name] = response.read(LIMIT + 1)
            require(len(blobs[name]) <= LIMIT and sha(blobs[name]) == manifest["files"][name], "served artifact differs from expected release: " + name)
    return blobs


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dist", type=Path, default=Path("dist"))
    parser.add_argument("--source", type=Path, default=Path("src/data/learning-hub.json"))
    parser.add_argument("--artifact-only", action="store_true")
    parser.add_argument("--base-url")
    parser.add_argument("--expected-publication", type=Path)
    parser.add_argument("--receipt", type=Path)
    args = parser.parse_args()
    result = {"schema": "metahumotonic/publication-verification@1", "observedAt": datetime.now(timezone.utc).isoformat(), "scope": "read-only HTTP readback" if args.base_url else "local artifact readback", "verifierSha256": sha(Path(__file__).read_bytes())}
    try:
        require(not args.base_url or args.expected_publication is not None, "live verification needs an independently supplied expected publication")
        manifest_path = args.expected_publication if args.base_url else args.dist / "learn/publication.json"
        manifest = json.loads(manifest_path.read_bytes())
        blobs = readback(args.base_url, manifest) if args.base_url else {name: (args.dist / name).read_bytes() for name in FILES}
        source = None if args.base_url or args.artifact_only else json.loads(args.source.read_bytes())
        result.update(verify(blobs, manifest, source))
        result["status"] = "PASS"
    except (ValueError, OSError, KeyError, TypeError, IndexError, AttributeError) as error:
        result.update(status="FAIL", error=str(error))
    if args.receipt:
        with args.receipt.open("x", encoding="utf8") as output:
            output.write(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(result, ensure_ascii=False))
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
