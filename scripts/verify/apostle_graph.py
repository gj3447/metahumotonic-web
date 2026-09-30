# /// script
# requires-python = ">=3.11"
# dependencies = ["rdflib==7.6.0", "pyshacl==0.40.1"]
# ///
"""Parse the built JSON-LD as RDF; validate SHACL and competency questions."""
import json
from copy import deepcopy
from pathlib import Path

from pyshacl import validate
from rdflib import Dataset, Graph, Namespace, URIRef
from rdflib.collection import Collection

ROOT = Path(__file__).resolve().parents[2]
SCHEMA = Namespace("https://schema.org/")
SKOS = Namespace("http://www.w3.org/2004/02/skos/core#")
PROV = Namespace("http://www.w3.org/ns/prov#")
ORIGIN = "https://metahumotonic.com"
CONTEXT = {"schema": str(SCHEMA), "skos": str(SKOS), "prov": str(PROV)}


def rdf(document):
    # This artifact uses only an inline context: parsing needs no remote fetch.
    if document.get("@context") != CONTEXT:
        raise ValueError("Unexpected JSON-LD context")
    dataset = Dataset(default_union=True)
    dataset.parse(data=json.dumps(document), format="json-ld")
    graph = Graph()
    for triple in dataset.triples((None, None, None)):
        graph.add(triple)
    return graph


def conforms(document):
    shapes = Graph().parse(ROOT / "docs/graph/apostles.shacl.ttl", format="turtle")
    return validate(rdf(document), shacl_graph=shapes, meta_shacl=True)


def main():
    document = json.loads((ROOT / "dist/apostles/graph.jsonld").read_text())
    ok, _, report = conforms(document)
    if not ok:
        raise ValueError(report)
    graph = rdf(document)
    members = list(Collection(graph, graph.value(URIRef(f"{ORIGIN}/apostles/#collection"), SKOS.memberList)))
    expected = [URIRef(f"{ORIGIN}/learn/#entity-apostle-{n}") for n in range(1, 13)]
    assert members == expected, "Ordered membership or identity drift"
    source = json.loads((ROOT / "src/data/apostles.json").read_text())["apostles"]
    for member, apostle in zip(members, source, strict=True):
        assert str(graph.value(member, SKOS.prefLabel)) == apostle["name"]
        pages = set(graph.objects(member, SCHEMA.subjectOf))
        expected_pages = {URIRef(f"{ORIGIN}/{prefix}/{apostle['slug']}/#page") for prefix in ("apostles", "wiki/apostles")}
        assert pages == expected_pages, f"Wrong documents for {member}"
        assert graph.value(member, PROV.wasDerivedFrom) == URIRef(f"{ORIGIN}/wiki/data.json")
        for page in pages:
            assert graph.value(page, SCHEMA.about) == member
            url = str(graph.value(page, SCHEMA.url))
            assert (ROOT / "dist" / url.removeprefix(f"{ORIGIN}/") / "index.html").is_file()
    assert graph.value(expected[8], SKOS.scopeNote), "Ninth entry must retain its editorial scope"
    # Negative controls exercise the validator, not just successful serialization.
    for mutation in ("orphan", "authority", "duplicate", "equivalence"):
        bad = deepcopy(document)
        concept = next(n for n in bad["@graph"] if n["@id"] == str(expected[0]))
        if mutation == "orphan":
            concept["schema:subjectOf"][0]["@id"] = f"{ORIGIN}/missing/#page"
        elif mutation == "authority":
            concept["skos:editorialNote"] = "USER_PRIMARY"
        elif mutation == "duplicate":
            collection = next(n for n in bad["@graph"] if n["@type"] == "skos:OrderedCollection")
            collection["skos:memberList"]["@list"][1] = {"@id": str(expected[0])}
        else:
            concept["http://www.w3.org/2002/07/owl#sameAs"] = {"@id": str(expected[1])}
        assert not conforms(bad)[0], f"Validator accepted {mutation}"
    print(f"apostle-rdf=PASS triples={len(graph)} SHACL=PASS competency=12 negative-controls=4")


if __name__ == "__main__":
    main()
