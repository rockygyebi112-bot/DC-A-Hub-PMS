const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, HeadingLevel, BorderStyle,
  WidthType, ShadingType, PageNumber, PageBreak, TableOfContents, TabStopType, TabStopPosition,
} = require("docx");

const OUT = path.join(__dirname, "unicef-meal-odf-sms-ghana-draft.docx");

const FONT = "Arial";
const border = { style: BorderStyle.SINGLE, size: 1, color: "BBBBBB" };
const cellBorders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 60, bottom: 60, left: 110, right: 110 };
const CONTENT_W = 9360;

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after ?? 120, before: opts.before ?? 0, line: 276 },
    alignment: opts.align,
    children: Array.isArray(text)
      ? text
      : [new TextRun({ text, bold: opts.bold, italics: opts.italics, size: opts.size, color: opts.color })],
  });
}
function h1(text) { return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] }); }
function h2(text) { return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] }); }
function h3(text) { return new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(text)] }); }
function bullet(runs) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { after: 80, line: 276 },
    children: Array.isArray(runs) ? runs : [new TextRun(runs)],
  });
}
function R(text, o = {}) { return new TextRun({ text, bold: o.bold, italics: o.italics, color: o.color }); }
function review(text) { return new TextRun({ text, bold: true, color: "B00000" }); }

function tableCell(content, { w, head = false, fill } = {}) {
  const para = Array.isArray(content) ? content : [new Paragraph({
    spacing: { after: 0, line: 252 },
    children: [new TextRun({ text: String(content), bold: head, size: 19 })],
  })];
  return new TableCell({
    borders: cellBorders, margins: cellMargins,
    width: { size: w, type: WidthType.DXA },
    shading: fill ? { fill, type: ShadingType.CLEAR } : undefined,
    children: para,
  });
}
function buildTable(colWidths, headers, rows) {
  const headRow = new TableRow({
    tableHeader: true,
    children: headers.map((hd, i) => tableCell(hd, { w: colWidths[i], head: true, fill: "1F3864" === "" ? undefined : "D9E2F3" })),
  });
  const bodyRows = rows.map((r) => new TableRow({
    children: r.map((c, i) => tableCell(c, { w: colWidths[i] })),
  }));
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [headRow, ...bodyRows],
  });
}

const children = [];

// Title block
children.push(new Paragraph({
  spacing: { after: 80 }, alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: "Technical Methodology and Workplan", bold: true, size: 40, color: "1F3864" })],
}));
children.push(new Paragraph({
  spacing: { after: 200 }, alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: "Provision of Monitoring, Evaluation, Accountability and Learning (MEAL) Specialist Services for the National Open Defecation Free (ODF) and Safely Managed Sanitation (SMS) Plan", bold: true, size: 26 })],
}));
children.push(p([R("Submitted to: ", { bold: true }), R("UNICEF Ghana — WASH Section, in collaboration with MLGCRA (lead), NDPC, OHLGS and GSS.")]));
children.push(p([R("Submitted by: ", { bold: true }), R("DC&A Hub — Research, Data Collection & Monitoring and Evaluation · P.O. Box CT 10685, Cantonments-Accra, Ghana · info@dcahub.com · www.dcahub.com")]));
children.push(p([R("Engagement type: ", { bold: true }), R("Individual Consultant (National) — Lead Consultant proposed from DC&A Hub, backed by the firm's MEAL capacity.")]));
children.push(p([R("Date: ", { bold: true }), review("[REVIEW] — insert submission date")]));

// Status note
children.push(new Paragraph({
  spacing: { before: 160, after: 160 },
  border: { left: { style: BorderStyle.SINGLE, size: 18, color: "1F3864", space: 8 } },
  children: [
    new TextRun({ text: "Note on status. ", bold: true }),
    new TextRun("This document is a first-draft technical methodology and workplan prepared for internal expert review by DC&A Hub. It is not a final submission. All items marked "),
    new TextRun({ text: "[REVIEW]", bold: true, color: "B00000" }),
    new TextRun(" require partner/expert confirmation (notably the Lead Consultant's CV against the qualification bar, individual-versus-firm contracting, and all financial rates). Items marked "),
    new TextRun({ text: "[ASSUMPTION]", bold: true, color: "7030A0" }),
    new TextRun(" record interpretations made in the absence of explicit ToR text."),
  ],
}));

children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: "Contents", bold: true, size: 28 })] }));
children.push(new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-2" }));
children.push(new Paragraph({ children: [new PageBreak()] }));

// 1. Understanding
children.push(h1("1. Understanding of the Objectives of the Assignment"));
children.push(p("We understand that UNICEF Ghana, in collaboration with MLGCRA as lead and with NDPC, OHLGS and GSS, is seeking an experienced Monitoring, Evaluation, Accountability and Learning (MEAL) Specialist to lead the design, roll-out and institutionalisation of a national MEAL system for the National Open Defecation Free (ODF) and Safely Managed Sanitation (SMS) Plan. The engagement is a long-term, performance-based assignment of approximately three years (2026–2028), home-based/remote with travel to selected districts, sourced nationally and contracted to an individual consultant."));
children.push(p("We understand the purpose of the assignment to be threefold: (i) to develop a comprehensive MEAL Framework for the National ODF and SMS Plan; (ii) to facilitate its roll-out across the sanitation sector; and (iii) to establish the systems, capacities and learning culture needed to sustain implementation over time. The framework does not stand alone — it must connect to the upgraded Basic Sanitation Information System (BaSIS) and the African Sanitation Systems Strengthening Programme, align with Government of Ghana planning and reporting systems, and feed established international reporting instruments, namely the WHO/UNICEF Joint Monitoring Programme (JMP), GLAAS, WASSMO, the Ngor Declaration (NGOR) commitments, the African Sanitation Policy Assessment Tool (ASPAT) and SMOSS."));
children.push(p("We understand the consultant is expected to work across the full delivery chain of the sanitation programme — from national policy and sector-wide reviews down to Metropolitan, Municipal and District Assemblies (MMDAs) and the communities they serve — and to do so in a way that strengthens Government systems rather than running parallel to them. The work spans technical framework design, programme maturity assessment, sector reporting and Joint Sector Reviews, capacity building and a sector community of practice, operational planning through Sanitation Acceleration Compacts, performance management, knowledge management and adaptive leadership, and ongoing review of sanitation protocols and data systems."));
children.push(p("Critically, the assignment is fundamentally about the safely managed sanitation service chain — containment → emptying/transport → treatment → reuse/safe disposal — and the MEAL system must measure service-chain integrity at every link, not merely toilet access. We also recognise that the ODF and SMS agenda is an equity agenda: progress is meaningful only when it reaches the poorest and most marginalised — including women and girls (for whom sanitation carries distinct safety, dignity and menstrual-health dimensions), children, persons with disabilities, and underserved rural and peri-urban populations. Gender Equality and Social Inclusion (GESI) is therefore a core analytical lens of the MEAL Framework we propose, not a cross-cutting afterthought."));
children.push(p([R("What success looks like. ", { bold: true }), R("At the end of the engagement the sector should possess: a coherent, indicator-driven MEAL Framework and Programme Indicator Reference Guide; a Programme Maturity Assessment Framework that situates interventions on a scaling continuum; a functioning reporting framework that compiles district→regional→national data into Government systems and feeds JSRs and international reporting; a trained sector leadership team and community of practice; District ODF and SMS plans and baselines anchored in Sanitation Acceleration Compacts; quality quarterly and annual performance reporting; and an embedded knowledge-management and adaptive-learning culture — all sustainable beyond the consultancy.")]));

// 2. Approach
children.push(h1("2. Our Approach"));
children.push(p("Our approach is built on five guiding principles that respond directly to the character of this assignment."));
children.push(p([R("(a) Government-systems-first, not parallel. ", { bold: true }), R("Every instrument we design — indicators, reporting templates, data flows, dashboards — will be built to live inside Government planning and reporting architecture (MLGCRA, NDPC, OHLGS, GSS) and the upgraded BaSIS, so the system endures after the consultancy ends. We design for institutionalisation from day one.")]));
children.push(p([R("(b) Service-chain and results-chain integrity. ", { bold: true }), R("We structure the MEAL Framework around two intersecting logics: the safely managed sanitation service chain (containment → transport/emptying → treatment → reuse/safe disposal) and the results chain (input → output → outcome → impact). Indicators are defined at each link of the service chain and each level of the results chain, and aggregated into composite indices for process, efficiency, effectiveness, sustainability, performance and context at district, regional and national levels.")]));
children.push(p([R("(c) Evidence-based and mixed-methods. ", { bold: true }), R("We commit to a mixed-methods design throughout — combining quantitative administrative and survey data with qualitative operational research (KIIs, FGDs, case studies, observation) and outcome mapping/harvesting. Where the assignment requires evaluative judgement (the evaluation plan, JSRs, maturity assessment), we anchor analysis in the OECD-DAC evaluation criteria — relevance, coherence, effectiveness, efficiency, impact and sustainability — adapted to a systems-strengthening context.")]));
children.push(p([R("(d) Equity, GESI and ethics by design. ", { bold: true }), R("Indicators and analysis are disaggregated by sex, disability, location (urban/peri-urban/rural) and wealth quintile where feasible, consistent with JMP equity reporting. All data collection and operational research follow recognised research-ethics standards (informed consent, confidentiality, do-no-harm, safe data handling). The ToR marks child-safeguarding as “No”; nevertheless, because field work touches communities where children are present, DC&A Hub will apply its standard ethical and safeguarding protocols (including child-safeguarding good practice) as a matter of professional standard. ")]));
children.push(p([review("[ASSUMPTION] "), R("No formal UNICEF child-safeguarding screening is triggered by this engagement; to be confirmed.", { italics: true })]));
children.push(p([R("(e) Adaptive, participatory learning. ", { bold: true }), R("We treat MEAL as a learning engine, not a compliance exercise. Frameworks and tools are co-created and validated with sector stakeholders through validation/learning workshops; the community of practice and adaptive-leadership components turn evidence into course-correction. International alignment (JMP, GLAAS, WASSMO, NGOR, ASPAT, SMOSS) is designed in, so national data flows upward to regional and global reporting without rework.")]));
children.push(p([R("Alignment to international frameworks. ", { bold: true }), R("The indicator architecture is explicitly cross-walked to the JMP service ladders and equity dimensions, GLAAS systems indicators, the NGOR commitments, ASPAT policy-assessment domains, WASSMO and SMOSS, so that a single national data backbone serves both domestic accountability and international reporting obligations.")]));

// 3. Methodology
children.push(h1("3. Our Methodology"));
children.push(p("We present the methodology as nine numbered phases. Phase 0 is foundational; Phases 1–8 map one-to-one onto the eight scope-of-work areas and the deliverables/deadlines in the ToR. Each phase states concretely what we will do, with whom, and what it produces."));

const phases = [
  ["Phase 0 — Inception and Mobilisation (foundational; precedes Deliverable 1)",
    "Before substantive design we will:",
    ["Mobilise the Lead Consultant and DC&A Hub backstopping team; agree roles and communication protocols.",
     "Hold an inception/kickoff meeting with UNICEF WASH and MLGCRA (and NDPC, OHLGS, GSS) to confirm scope, priorities, decision rights, access to BaSIS and existing data, and the sequencing of district travel.",
     "Conduct a structured desk review of the National ODF/SMS Plan, BaSIS documentation, the African Sanitation Systems Strengthening Programme, prior sector reviews, and the international instruments (JMP, GLAAS, WASSMO, NGOR, ASPAT, SMOSS).",
     "Produce a short Inception Report with a refined workplan, stakeholder/data-source map, and risk log, validated with the client."],
    "Output: Inception Report and validated workplan."],
  ["Phase 1 — MEAL Framework and Programme Indicator Reference Guide (Scope 1 → Deliverable 1; due 30 Sep 2026, ~56 days)",
    "We will develop the comprehensive MEAL Framework and its companion Programme Indicator Reference Guide, comprising:",
    ["Indicator architecture for both systems strengthening and service delivery, structured along the service chain (containment → transport → treatment → reuse/disposal) and the results chain (input → output → outcome → impact).",
     "Composite indices for process, efficiency, effectiveness, sustainability, performance and context, computable at district, regional and national levels, with defined construction, weighting and data sources.",
     "A reference guide giving, for every indicator: definition, rationale, unit, disaggregation (sex/disability/location/wealth), data source, collection method and frequency, responsible actor, and the BaSIS/Government and international (JMP/GLAAS/etc.) field it maps to.",
     "An evaluation plan (anchored in OECD-DAC criteria) and an evidence-generation outline specifying the studies/evaluations the sector will commission over the plan period.",
     "A validation workshop with MLGCRA/UNICEF and partners to finalise and secure ownership."],
    "Output: MEAL Framework + Programme Indicator Reference Guide (Deliverable 1)."],
  ["Phase 2 — Programme Maturity Assessment Framework (PMAM) (Scope 2 → Deliverable 2; due 30 Dec 2026, ~40 days)",
    "We will design the Programme Maturity Assessment Framework, including the MMDA-level instrument:",
    ["A maturity model placing interventions on a defined scaling continuum (e.g. nascent → emerging → established → consolidated → sustained), with descriptors per stage.",
     "Composite maturity indices combining quantitative metrics with qualitative scoring rubrics (mixed quant + qual).",
     "A dedicated module assessing MMDA delivery capacity and maturity.",
     "Scoring guidance, evidence requirements, and a piloting note so the framework is usable by Government staff and independent assessors."],
    "Output: Programme Maturity Assessment Framework(s), including MMDA (Deliverable 2)."],
  ["Phase 3 — Reporting Framework and Joint Sector Review Guidelines (Scope 3 → Deliverable 3; due 28 Feb 2027, ~30 days)",
    "We will establish the reporting mechanism/platform and review architecture:",
    ["A reporting framework defining quarterly and annual report formats, content and responsibilities, and the data-compilation flow district → regional → national into Government systems (and BaSIS).",
     "Guidelines for Joint Sector Reviews at annual, mid-term and end-of-term points — scope, participants, evidence inputs, scoring against the MEAL indices, and the feedback loop into planning.",
     "Alignment of report outputs to international reporting cycles (JMP/GLAAS/WASSMO/NGOR/ASPAT/SMOSS)."],
    "Output: Reporting Framework + JSR guidelines (Deliverable 3)."],
  ["Phase 4 — Capacity Building, Leadership Team and Community of Practice (Scope 4 → Deliverable 4; due 30 Jun 2027, ~196 days incl. 10 field)",
    "We will build sector capacity to use the MEAL Framework and embed it institutionally:",
    ["A capacity-building plan and curriculum/materials on the framework, indices, tools and reporting.",
     "Establishment of a sector MEAL leadership team and a community of practice to sustain use and peer learning.",
     "Technical support to Government staff at national, regional and district levels.",
     "Technical support and quality assurance (QA) to independent consultants commissioned to conduct studies and evaluations under the evidence-generation plan.",
     "A modest field component (10 days) for hands-on support in selected districts."],
    "Output: Functioning leadership team + community of practice + delivered capacity-building support (Deliverable 4)."],
  ["Phase 5 — Operational Planning for Results Delivery (Scope 5 → Deliverable 5; due 30 Dec 2027, ~120 days incl. 80 field)",
    "We will support results-oriented operational planning at every tier:",
    ["Technical support to Sanitation Acceleration Compacts — Ministerial (M-SAC), Regional (RM-SAC) and District (DCE-SAC).",
     "Support to develop District ODF and SMS Plans, district M&E plans, baseline reports, and annual plans.",
     "A substantial field component (80 of 120 days) for district-level facilitation, baseline support and plan development."],
    "Output: SACs supported + District plans + baselines + annual plans (Deliverable 5)."],
  ["Phase 6 — Programme Performance Management (Scope 6 → Deliverable 6; due 30 Dec 2028, ~180 days incl. 40 field)",
    "Across the implementation period we will provide ongoing performance-management support:",
    ["Technical support for reporting, performance-data analysis and Joint Sector Reviews at national, regional and district levels.",
     "Data Quality Assessments (DQAs) to safeguard the integrity of the data backbone.",
     "Production support for Quarterly Sector Progress Reports and Annual Programme Performance Reports."],
    "Output: Quality performance reporting + JSRs delivered (Deliverable 6)."],
  ["Phase 7 — Knowledge Management and Adaptive Leadership (Scope 7 → Deliverable 7; due 30 Dec 2028, ~120 days incl. 40 field)",
    "We will embed a learning culture:",
    ["A knowledge-management (KM) plan for the sector.",
     "Outcome mapping/harvesting, case studies and lessons-learned products.",
     "Support to a district and national learning culture and adaptive programming — feeding evidence back into decisions."],
    "Output: KM/adaptive-leadership outputs (Deliverable 7)."],
  ["Phase 8 — Review of Protocols and Data Systems (Scope 8 → Deliverable 8; due 30 Dec 2028, ~8 days)",
    "On an ongoing basis we will:",
    ["Review sanitation protocols and data systems, identifying gaps and improvement opportunities.",
     "Recommend automation and visualisation improvements to BaSIS and related systems to reduce manual effort and improve timeliness and decision-usefulness."],
    "Output: Protocols/data-systems review and recommendations (Deliverable 8)."],
];
for (const [title, lead, items, out] of phases) {
  children.push(h3(title));
  children.push(p(lead));
  for (const it of items) children.push(bullet(it));
  children.push(p([R(out, { italics: true })], { before: 40 }));
}

// 4. Workplan
children.push(h1("4. Workplan and Schedule"));
children.push(p("The workplan aligns each deliverable to the ToR deadlines and indicative level of effort. Field days are drawn directly from the ToR table."));
children.push(buildTable([520, 4200, 900, 1700, 2040],
  ["#", "Deliverable", "Scope", "Due date", "Indicative days (incl. field)"],
  [
    ["1", "Programme Indicator Reference Guide + MEAL Framework", "1", "30 Sep 2026", "56"],
    ["2", "Maturity Assessment Framework(s), incl. MMDA", "2", "30 Dec 2026", "40"],
    ["3", "Reporting Framework + JSR guidelines", "3", "28 Feb 2027", "30"],
    ["4", "Leadership team + community of practice + capacity building", "4", "30 Jun 2027", "196 (incl. 10 field)"],
    ["5", "SACs + District plans + baselines + annual plans", "5", "30 Dec 2027", "120 (incl. 80 field)"],
    ["6", "Quality reporting + JSRs", "6", "30 Dec 2028", "180 (incl. 40 field)"],
    ["7", "KM / adaptive-leadership outputs", "7", "30 Dec 2028", "120 (incl. 40 field)"],
    ["8", "Protocols / data-systems review", "8", "30 Dec 2028", "8"],
    ["", "Total", "", "", "750 days (incl. 170 field)"],
  ]));
children.push(p([R("Sequencing notes. ", { bold: true }), R("Deliverables 1–3 are foundational design products front-loaded into 2026–early 2027. Deliverable 4 (capacity/leadership/CoP) builds on them through mid-2027. Deliverable 5 (operational planning) runs through 2027 with the heaviest field load. Deliverables 6–8 are the multi-year implementation, performance-management, learning and systems-review streams running to end-2028. The phases overlap in practice; the schedule reflects the ToR's deliverable deadlines, not strictly sequential blocks.")], { before: 120 }));
children.push(p([R("Note on level of effort. ", { bold: true }), R("Phases 6 and 7 (180 + 120 days) are spread across calendar years 2027–2028 and represent sustained periodic engagement rather than continuous full-time work. The Lead Consultant is backstopped by DC&A Hub's team to ensure continuity across the long performance period.")]));

// 5. Team
children.push(h1("5. Proposed Lead Consultant and Team"));
children.push(p("This is an Individual Consultant engagement. DC&A Hub responds by proposing a named Lead Consultant drawn from the firm, backed by the firm's MEAL capacity and 16-region field network for surge support during the heavy field phases."));
children.push(p([R("Proposed Lead Consultant — Prof. James Kwame Mensah (Managing Partner, DC&A Hub). ", { bold: true }), R("PhD (Development Administration); MPhil (Public Administration); BA (Sociology with Political Science). Expertise spanning monitoring, evaluation and learning; quantitative and qualitative research; local governance and decentralisation; PPP/LED; policy development; institutional reform and strengthening; training and capacity building; urbanisation; climate change and sustainable development. His combination of MEL depth, local-governance/decentralisation expertise (directly relevant to the MMDA, OHLGS and District-Assembly dimensions of this assignment) and policy/institutional-strengthening experience makes him a strong fit to lead a Government-systems-embedded MEAL assignment.")]));
children.push(new Paragraph({
  spacing: { before: 120, after: 120 },
  border: { left: { style: BorderStyle.SINGLE, size: 18, color: "B00000", space: 8 } },
  children: [
    new TextRun({ text: "[REVIEW] — Qualification bar. ", bold: true, color: "B00000" }),
    new TextRun("The firm must confirm, against Prof. Mensah's current CV, that he meets the ToR minimum qualifications: (i) at least 10 years' M&E experience; (ii) an advanced (Master's) degree in a relevant field plus a specific M&E qualification/training; (iii) direct experience with Government/development partners on monitoring/reporting and stakeholder reviews; and (iv) demonstrated experience developing MEAL and Programme Assessment Frameworks and quant+qual operational research with knowledge management (case studies). The firm must also decide individual-versus-firm contracting (the ToR is an individual-consultant call; confirm whether to bid the named individual or seek to substitute a firm modality)."),
  ],
}));
children.push(p([R("Proposed Deputy / Supporting Specialist — Mr. Selom Apanya (Head of Consultancy, DC&A Hub). ", { bold: true }), R("MPhil (Economics); BA (Economics). Expertise in MEL; quantitative and qualitative research; economic analysis; PPP/LED; WASH; policy development; strategic planning. His WASH and economic-analysis background supports the service-chain indicator design, index construction and performance analysis.")]));
children.push(p([R("Firm backstopping. ", { bold: true }), R("The Lead Consultant is supported by DC&A Hub's multidisciplinary team of researchers, MEL specialists and data analysts, plus associate consultants and a backstopping pool (statisticians, economists, local-governance experts, IT professionals, field managers) and standby field agents in all 16 regions of Ghana for rapid mobilisation during the 170 ToR field days. "), review("[REVIEW] "), R("Confirm the full associate-consultant roster to be named in the final submission.")]));

// 6. Relevant experience
children.push(h1("6. Relevant Experience"));
children.push(p("DC&A Hub brings directly relevant, recent and verifiable experience across WASH/sanitation, local governance, MEAL-framework design, M&E systems, and quality-assurance monitoring. The following assignments — all genuine DC&A Hub engagements — evidence our fit."));
children.push(buildTable([2900, 2500, 3960],
  ["Project", "Client / Donor", "Relevance to this assignment"],
  [
    ["Social & Financial Impact Assessment, Basic Sanitation Fund", "UNICEF / OPM / MAPLE", "Direct UNICEF-linked sanitation assignment; social and financial impact assessment in the same sub-sector as the ODF/SMS Plan."],
    ["End-Term Evaluation, Hygiene Behaviour Change Campaign (HBCC)", "WSUP (Unilever–FCDO)", "WASH/public-health evaluation with baseline survey — evaluation design, OECD-DAC-aligned judgement, sanitation/hygiene behaviour."],
    ["Rapid Assessment, Urban Resilience to COVID-19", "WSUP", "Urban WASH rapid assessment — peri-urban sanitation context and fast-turnaround operational research."],
    ["Baseline & Impact Assessment, Ghana Urban Water (FYIP)", "World Bank / MAPLE", "Water/WASH baseline and impact assessment across 36 communities — baseline methodology and large multi-community fieldwork relevant to district baselines (Deliverable 5)."],
    ["Impact Evaluation, District Development Facility (DDF)", "SECO / Shawbell", "Local-governance/decentralisation impact evaluation at District-Assembly level — relevant to MMDA performance and the SAC/District-plan work."],
    ["Web-based M&E System", "World Bank / GIPC", "M&E systems design/development — relevant to BaSIS integration and the automation/visualisation review (Deliverable 8)."],
    ["TPM & DQA, Strengthening Civil Society (SCS)", "Netherlands MFA / ECORYS", "Third-party monitoring and Data Quality Assessments — relevant to the DQA and data-integrity components (Deliverable 6)."],
    ["Research: Women Administrators / Barriers to Women in Local Elections (GESI)", "Global Affairs Canada / FCM, NALAG", "National GESI research in local governance — supports the GESI lens and equity disaggregation of the MEAL Framework."],
  ]));
children.push(p("This combination — a UNICEF sanitation assignment, two WSUP WASH engagements, a World Bank water baseline, a local-governance impact evaluation, an M&E-systems build, and a TPM/DQA mandate — maps closely onto the eight scope areas of this ToR.", { before: 120 }));

// 7. Management & QA
children.push(h1("7. Management and Quality Assurance"));
children.push(p([R("Management. ", { bold: true }), R("The Lead Consultant holds primary technical and client-facing responsibility, reporting to UNICEF WASH and MLGCRA. DC&A Hub provides institutional backstopping: a designated firm partner for contract/QA oversight, a coordination point for field mobilisation across the 16 regions, and surge specialists for the framework-design and field-heavy phases.")]));
children.push(p([R("Quality assurance. ", { bold: true }), R("We apply DC&A Hub's standard QA system: (i) a peer-review step on every major deliverable (MEAL Framework, PMAM, reporting framework, reports) before submission; (ii) Data Quality Assessments built into the performance-management stream; (iii) validation/learning workshops to secure technical soundness and client ownership; and (iv) version-controlled documentation aligned to BaSIS and Government reporting standards.")]));
children.push(p([R("Ethics and safeguarding. ", { bold: true }), R("All operational research and field activity follow recognised research-ethics standards (informed consent, confidentiality, do-no-harm, secure data handling). Although the ToR marks child-safeguarding as “No”, DC&A Hub will nonetheless apply child-safeguarding good practice during community-level fieldwork as a matter of professional standard.")]));
children.push(p([R("Risk management. ", { bold: true }), R("Key risks — data availability/quality in BaSIS, the long multi-year performance period, district access and logistics, and coordination across five institutions (UNICEF, MLGCRA, NDPC, OHLGS, GSS) — are managed through the inception risk log, firm backstopping for continuity, and the systems-first design that reduces dependence on any single individual.")]));

// 8. Budget
children.push(h1("8. Budget / Price Quotation (placeholder — separate process)"));
children.push(new Paragraph({
  spacing: { before: 80, after: 120 },
  border: { left: { style: BorderStyle.SINGLE, size: 18, color: "B00000", space: 8 } },
  children: [
    new TextRun({ text: "[REVIEW] — The price quotation is out of scope for this technical draft and will be prepared through the firm's separate budgeting process. ", bold: true, color: "B00000" }),
    new TextRun("The ToR requires a price quotation stating: expected man-days per task, a daily professional fee, DSA (per-diem), and kilometric transport rates — all in GHS, all-inclusive, on a “best value for money” basis."),
  ],
}));
children.push(p([R("Indicative man-days per task (from the ToR deliverable table), for the firm to confirm:", { bold: true })]));
children.push(buildTable([5760, 1900, 1700],
  ["Deliverable / task", "Indicative man-days", "Of which field"],
  [
    ["1. MEAL Framework + Indicator Reference Guide", "56", "—"],
    ["2. Maturity Assessment Framework(s)", "40", "—"],
    ["3. Reporting Framework + JSR guidelines", "30", "—"],
    ["4. Leadership team + CoP + capacity building", "196", "10"],
    ["5. SACs + District plans + baselines + annual plans", "120", "80"],
    ["6. Quality reporting + JSRs", "180", "40"],
    ["7. KM / adaptive-leadership outputs", "120", "40"],
    ["8. Protocols / data-systems review", "8", "—"],
    ["Total", "750", "170"],
  ]));
children.push(p([R("Rates to be set by the firm in GHS:", { bold: true })], { before: 120 }));
children.push(bullet([R("Daily professional fee: "), review("[REVIEW] — firm to set rate in GHS")]));
children.push(bullet([R("Daily Subsistence Allowance (DSA) for field days: "), review("[REVIEW] — firm to set rate in GHS")]));
children.push(bullet([R("Kilometric transport rate: "), review("[REVIEW] — firm to set rate in GHS")]));
children.push(p([review("[ASSUMPTION] "), R("The 750 total man-days and 170 field days are the simple sums of the per-deliverable figures stated in the ToR table; the firm should confirm whether deliverables with overlapping calendar windows (notably 6 and 7) imply concurrent rather than additive effort before pricing.", { italics: true })]));

children.push(new Paragraph({
  spacing: { before: 240 }, alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: "Prepared by DC&A Hub as a first-draft technical methodology and workplan for expert review. Not a final submission.", italics: true, size: 18, color: "666666" })],
}));

const doc = new Document({
  styles: {
    default: { document: { run: { font: FONT, size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: FONT, color: "1F3864" },
        paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: FONT, color: "1F3864" },
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 22, bold: true, font: FONT, color: "2E4D7B" },
        paragraph: { spacing: { before: 160, after: 80 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 600, hanging: 280 } } } }] },
    ],
  },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          children: [
            new TextRun({ text: "DC&A Hub — UNICEF MEAL Specialist (ODF & SMS) — First draft for expert review", size: 16, color: "888888" }),
            new TextRun({ text: "\tPage ", size: 16, color: "888888" }),
            new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "888888" }),
          ],
        })],
      }),
    },
    children,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log("WROTE " + OUT + " (" + buf.length + " bytes)");
});
