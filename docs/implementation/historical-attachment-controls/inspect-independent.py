"""Independent source inspection using stdlib parsers; no production-reader imports."""
import gzip
import hashlib
import html
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qs, urlparse
import xml.etree.ElementTree as ET

ROOT = Path(__file__).parent
AKN = "{http://docs.oasis-open.org/legaldocml/ns/akn/3.0}"


def folded_text(node):
    return " ".join("".join(node.itertext()).split())


ASCII_ACCENTS = {
    "addi": "addì", "agibilita": "agibilità", "attivita": "attività", "autorita": "autorità", "avra": "avrà",
    "caffe": "caffè", "capacita": "capacità", "citta": "città", "complessita": "complessità", "conformita": "conformità",
    "da": "dà", "densita": "densità", "e": "è", "fattibilita": "fattibilità", "finalita": "finalità", "gia": "già",
    "gioventu": "gioventù", "incolumita": "incolumità", "infiammabilita": "infiammabilità", "modalita": "modalità",
    "ne": "nè", "necessita": "necessità", "nonche": "nonchè", "neutralita": "neutralità", "permeabilita": "permeabilità",
    "piu": "più", "potenzialita": "potenzialità", "procedera": "procederà", "promiscuita": "promiscuità", "puo": "può",
    "quantita": "quantità", "responsabilita": "responsabilità", "sara": "sarà", "titolarita": "titolarità",
    "uniformita": "uniformità", "unita": "unità",
}


def legal_text(text):
    def accent(match):
        source = match.group(0)[:-1]
        replacement = ASCII_ACCENTS.get(source.lower())
        if not replacement:
            return match.group(0)
        if source.isupper():
            return replacement.upper()
        return replacement[0].upper() + replacement[1:] if source[:1].isupper() else replacement
    value = re.sub(r"[A-Za-z]+'", accent, html.unescape(text))
    value = " ".join(value.split())
    value = re.sub(r"\s+([.,;:])", r"\1", value)
    return re.sub(r"^(?:Articolo|Art\.?)\s*(\d+(?:-[a-z0-9]+)?)\.?\s+", r"Art. \1. ", value, flags=re.I)


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


class DetailText(HTMLParser):
    BREAKS = {"br", "p", "div", "h2", "tr", "td", "th"}
    HIDDEN = {"script", "style", "template"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.hidden = 0
        self.tables = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in self.HIDDEN:
            self.hidden += 1
        if tag == "table":
            self.tables += 1
        if "article-num-akn" in attrs.get("class", "").split():
            self.parts = []
        if tag in self.BREAKS and not self.hidden:
            self.parts.append(" ")

    def handle_endtag(self, tag):
        if tag in self.BREAKS and not self.hidden:
            self.parts.append(" ")
        if tag in self.HIDDEN and self.hidden:
            self.hidden -= 1

    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)

    @property
    def text(self):
        return legal_text("".join(self.parts))


def navigation_request(onclick):
    route = re.search(r"showArticle\('([^']+)'", onclick).group(1)
    query = parse_qs(urlparse(html.unescape(route)).query)
    value = lambda name: query["art." + name][0]
    return {"idArticolo": int(value("idArticolo")), "sottoArticolo": int(value("idSottoArticolo")),
            "sottoArticolo1": int(value("idSottoArticolo1")), "flagTipoArticolo": value("flagTipoArticolo"),
            "idGruppo": int(value("idGruppo")), "progressivo": int(value("progressivo")),
            "versione": int(value("versione")), "dataGU": value("dataPubblicazioneGazzetta"),
            "codiceRedazionale": value("codiceRedazionale")}


def successful_details():
    rows = {}
    for manifest_path in sorted(ROOT.glob("independent-details-*/manifest.json")):
        manifest = json.loads(manifest_path.read_text())
        for capture in manifest.get("captures", []):
            if capture.get("status") != 200 or not capture.get("file") or capture.get("failure"):
                continue
            request = capture["request"]
            if request["flagTipoArticolo"] == "0" and 2 <= request["idArticolo"] <= 13:
                label = str(request["idArticolo"])
            elif request["flagTipoArticolo"] in {"1", "2"}:
                label = "Allegato " + ("I" if request["flagTipoArticolo"] == "1" else "II")
            else:
                continue
            key = (request["dataVigenza"], label)
            assert key not in rows, key
            rows[key] = (manifest_path.parent, capture)
    return rows


def inspect(date, captures):
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
    detail_controls = []
    if date in {"2014-01-01", "2026-10-07"}:
        by_label = {row["label"].removeprefix("Art. ").rstrip("."): node for row, node in zip(inventory[:len(articles)], articles)}
        by_label.update({attachment.get("name"): attachment.find(AKN + "mainBody") for attachment in attachments})
        supplied = {row["label"]: navigation_request(row["onclick"]) for row in nav.items}
        conclusion = tree.find(f"./{AKN}act/{AKN}conclusions")
        for label in [str(value) for value in range(2, 14)] + ["Allegato I", "Allegato II"]:
            capture_dir, capture = captures[(date, label)]
            request = capture["request"]
            assert all(request[name] == supplied[label][name] for name in supplied[label])
            raw = gzip.decompress((capture_dir / capture["file"]).read_bytes())
            assert hashlib.sha256(raw).hexdigest() == capture["sha256"]
            envelope = json.loads(raw)
            atto = envelope["data"]["atto"]
            parser = DetailText()
            parser.feed(atto["articoloHtml"])
            expected = folded_text(by_label[label])
            if label == "13" and conclusion is not None:
                expected += " " + folded_text(conclusion)
            assert legal_text(expected) == parser.text, (date, label)
            start, end = atto["articoloDataInizioVigenza"], atto.get("articoloDataFineVigenza")
            selected = date.replace("-", "")
            assert start <= selected and (not end or end == "99999999" or selected <= end)
            assert [atto["annoGU"], atto["meseGU"], atto["giornoGU"]] == [2011, 9, 22]
            detail_controls.append({"label": label, "request": request, "raw_sha256": capture["sha256"],
                "raw_decoded_bytes": capture["decoded_bytes"], "text_sha256": hashlib.sha256(parser.text.encode()).hexdigest(),
                "effective_from": start, "effective_to": end, "direct_html_tables": parser.tables,
                "comparison": "exact legal text after enumerated official ASCII/Unicode typography equivalents"
                    + ("; appended conclusion independently matched" if label == "13" else "")})
        assert len(detail_controls) == 14
    return {"snapshot": date, "xml_sha256": hashlib.sha256(xml).hexdigest(),
            "portal_sha256": hashlib.sha256(portal).hexdigest(), "navigation": nav.items,
            "xml_inventory": inventory, "xml_table_shapes": table_shapes,
            "xml_graphic_count": len(list(tree.iter(AKN + "img"))),
            "detail_controls": detail_controls,
            "source_equivalence": "14 non-anchor details independently match; first occurrence is controlled by the rendered portal" if detail_controls
                else "unverified; no independent detail set selected for this snapshot"}


def main():
    captures = successful_details()
    assert len(captures) == 28
    controls = [inspect(date, captures) for date in ["2012-01-01", "2014-01-01", "2026-10-07"]]
    for control in controls:
        labels = [row["label"] for row in control["navigation"]]
        expected = [row["label"].removeprefix("Art. ").rstrip(".") for row in control["xml_inventory"]]
        assert labels == expected, (control["snapshot"], labels, expected)
        assert len(labels) == len(set(labels)) == 15
    privacy_manifests = sorted(ROOT.glob("privacy-boundary-*/manifest.json"))
    assert privacy_manifests
    privacy_manifest_path = privacy_manifests[-1]
    privacy_manifest = json.loads(privacy_manifest_path.read_text())
    assert privacy_manifest["outcome"] == "complete"
    assert privacy_manifest["policy"]["max_new_requests"] == 5
    assert privacy_manifest["policy"]["max_attempts_per_coordinate"] == 3
    assert privacy_manifest["policy"]["traffic"] == "strictly sequential"
    assert privacy_manifest["prior_attempts"] == [{
        "name": "privacy-article-1-2018-09-18", "attempts": 1,
        "lastOutcome": "transient_failure", "failure": "UND_ERR_CONNECT_TIMEOUT",
    }]
    provenance_path = ROOT.parent / "release-live-canaries-2026-10-06.json"
    provenance = json.loads(provenance_path.read_text())
    expected_text = {
        "2018-09-18": "Art. 1. Diritto alla protezione dei dati personali 1. Chiunque ha diritto alla protezione dei dati personali che lo riguardano. ((PERIODO SOPPRESSO DALLA L. 4 NOVEMBRE 2010, N. 183)).",
        "2018-09-19": "Art. 1. (( (Oggetto). )) ((Il trattamento dei dati personali avviene secondo le norme del regolamento (UE) 2016/679 del Parlamento europeo e del Consiglio, del 27 aprile 2016, di seguito «Regolamento», e del presente codice, nel rispetto della dignità umana, dei diritti e delle libertà fondamentali della persona.))",
    }
    expected_ranges = {
        "2018-09-18": ["20101124", "20180918"],
        "2018-09-19": ["20180919", "99999999"],
    }
    privacy_controls = []
    assert len(privacy_manifest["captures"]) == 2
    for capture in privacy_manifest["captures"]:
        date = capture["request"]["dataVigenza"]
        assert capture["state"] == "complete" and capture["classification"] == "success"
        assert capture["status"] == 200 and capture["decoded_bytes"] <= 24 * 1024 * 1024
        provenance_attempt = provenance["attempts"][capture["provenance_attempt"]]
        assert capture["provenance_file"] == provenance_path.name
        assert capture["url"] == provenance_attempt["url"]
        assert capture["request"] == provenance_attempt["request"]
        raw = gzip.decompress((privacy_manifest_path.parent / capture["file"]).read_bytes())
        assert hashlib.sha256(raw).hexdigest() == capture["sha256"]
        envelope = json.loads(raw)
        assert envelope["success"] is True
        atto = envelope["data"]["atto"]
        parser = DetailText()
        parser.feed(atto["articoloHtml"])
        assert parser.text == expected_text[date]
        actual_range = [atto["articoloDataInizioVigenza"], atto["articoloDataFineVigenza"]]
        assert actual_range == expected_ranges[date]
        selected = date.replace("-", "")
        assert actual_range[0] <= selected <= actual_range[1]
        assert [atto["annoGU"], atto["meseGU"], atto["giornoGU"]] == [2003, 7, 29]
        privacy_controls.append({"date": date, "request": capture["request"],
            "raw_sha256": capture["sha256"], "raw_decoded_bytes": capture["decoded_bytes"],
            "text": parser.text, "text_sha256": hashlib.sha256(parser.text.encode()).hexdigest(),
            "effective_range": actual_range, "provenance_attempt": capture["provenance_attempt"]})
    assert [row["date"] for row in privacy_controls] == ["2018-09-18", "2018-09-19"]
    privacy_boundary = {"status": "verified", "dates": [row["date"] for row in privacy_controls],
        "effective_ranges": [row["effective_range"] for row in privacy_controls],
        "wording": ["Diritto alla protezione dei dati personali", "Oggetto"],
        "total_new_requests": len(privacy_manifest["captures"]),
        "total_attempts_including_retained_failure": len(privacy_manifest["captures"]) + 1,
        "manifest": str(privacy_manifest_path.relative_to(ROOT)), "controls": privacy_controls}
    output = {"method": "Python ElementTree + HTMLParser; exact source-order/detail comparison independent of TypeScript parser",
              "controls": controls, "privacy_boundary": privacy_boundary}
    payload = (json.dumps(output, ensure_ascii=False, indent=2) + "\n").encode()
    (ROOT / "independent-source-controls.json.gz").write_bytes(gzip.compress(payload, mtime=0))
    print(json.dumps({"snapshots": [c["snapshot"] for c in controls], "matched_occurrences_per_snapshot": 15,
                      "verified_details": {c["snapshot"]: len(c["detail_controls"]) for c in controls if c["detail_controls"]},
                      "ascii_attachment_shapes": {c["snapshot"]: [[t["rows"], len(t["cells_in_source_order"])] for t in c["xml_table_shapes"]]
                                                   for c in controls if c["detail_controls"]},
                      "privacy_boundary": {key: privacy_boundary[key] for key in ["status", "dates", "effective_ranges", "wording",
                          "total_new_requests", "total_attempts_including_retained_failure"]}}))


if __name__ == "__main__":
    main()
