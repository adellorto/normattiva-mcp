"""Independent source inspection using stdlib parsers; no production-reader imports."""
import gzip
import hashlib
import json
from html.parser import HTMLParser
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).parent
AKN = "{http://docs.oasis-open.org/legaldocml/ns/akn/3.0}"


def folded_text(node):
    return " ".join("".join(node.itertext()).split())


def text_control(node):
    text = folded_text(node)
    return {"text_sha256": hashlib.sha256(text.encode()).hexdigest(),
            "text_characters": len(text), "opening": text[:80]}


class Navigation(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.items = []
        self.anchor = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "a" and "numero_articolo" in attrs.get("class", "").split():
            self.anchor = {"label": "", "onclick": attrs.get("onclick")}

    def handle_data(self, data):
        if self.anchor is not None:
            self.anchor["label"] += data

    def handle_endtag(self, tag):
        if tag == "a" and self.anchor is not None:
            self.anchor["label"] = " ".join(self.anchor["label"].split())
            self.items.append(self.anchor)
            self.anchor = None


def inspect(date):
    directory = ROOT / ("011G0193-" + date)
    xml = gzip.decompress((directory / "capture-2.gz").read_bytes())
    portal = gzip.decompress((directory / "capture-1.gz").read_bytes())
    tree = ET.fromstring(xml)
    nav = Navigation()
    nav.feed(portal.decode())
    articles = tree.findall(f"./{AKN}act/{AKN}body/{AKN}article")
    attachments = tree.findall(f"./{AKN}act/{AKN}attachments/{AKN}attachment/{AKN}doc")
    inventory = [{"kind": "article", "label": folded_text(a.find(AKN + "num")),
                  "eid": a.get("eId"), **text_control(a)} for a in articles]
    table_shapes = []
    for attachment in attachments:
        main = attachment.find(AKN + "mainBody")
        inventory.append({"kind": "attachment", "label": attachment.get("name"),
                          **text_control(main)})
        for table in main.iter(AKN + "table"):
            rows = list(table.iter(AKN + "tr"))
            table_shapes.append({"attachment": attachment.get("name"), "rows": len(rows),
                "cells_in_source_order": [{"row": ri, "source_column": ci,
                    "header": cell.tag == AKN + "th", "row_span": cell.get("rowspan", "1"),
                    "column_span": cell.get("colspan", "1"), **text_control(cell)}
                    for ri, row in enumerate(rows)
                    for ci, cell in enumerate(c for c in row if c.tag in {AKN + "th", AKN + "td"})]})
    # This baseline is independently extracted XML content. Full content verification
    # still requires separate rendered/detail attachment representations.
    return {"snapshot": date, "xml_sha256": hashlib.sha256(xml).hexdigest(),
            "portal_sha256": hashlib.sha256(portal).hexdigest(), "navigation": nav.items,
            "xml_inventory": inventory, "xml_table_shapes": table_shapes,
            "xml_graphic_count": len(list(tree.iter(AKN + "img"))),
            "source_equivalence": "unverified; no independent attachment detail captures"}


def main():
    controls = [inspect(date) for date in ["2012-01-01", "2014-01-01", "2026-10-07"]]
    for control in controls:
        labels = [row["label"] for row in control["navigation"]]
        expected = [row["label"].removeprefix("Art. ").rstrip(".") for row in control["xml_inventory"]]
        assert labels == expected, (control["snapshot"], labels, expected)
        assert len(labels) == len(set(labels)) == 15
    output = {"method": "Python ElementTree + HTMLParser; exact source-order comparison independent of TypeScript parser",
              "controls": controls}
    payload = (json.dumps(output, ensure_ascii=False, indent=2) + "\n").encode()
    (ROOT / "independent-source-controls.json.gz").write_bytes(gzip.compress(payload, mtime=0))
    print(json.dumps({"snapshots": [c["snapshot"] for c in controls], "matched_occurrences_per_snapshot": 15,
                      "table_rows_per_snapshot": [[t["rows"] for t in c["xml_table_shapes"]] for c in controls]}))


if __name__ == "__main__":
    main()
