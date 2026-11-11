# StepCharge AI — Preliminary Project Report (Academic Year 2026–27)

**Degree:** Bachelor of Engineering (Information Technology)  
**University:** Savitribai Phule Pune University, Pune  
**College:** MVP'S Karmaveer Baburao Ganpatrao Thakare College of Engineering, Nashik  
**Department:** Department of Information Technology  
**Project Title:** *StepCharge AI: Smart Footstep Energy Harvesting and Monitoring System*

---

## 1. Project Directory Structure

```
StepCharge_AI_Report/
│
├── main.tex                       # Master LaTeX root document
├── references.bib                 # IEEE-formatted bibliography
├── README.md                      # Compilation and editing guide
│
├── frontmatter/                   # University and college certificates & preliminaries
│   ├── titlepage.tex              # Official SPPU & KBTCOE cover page
│   ├── certificate.tex            # Departmental institutional certificate
│   ├── university_certificate.tex # SPPU examination certificate
│   ├── acknowledgement.tex        # Institutional and guide acknowledgement
│   ├── abstract.tex               # Technical abstract with keywords
│   └── abbreviations.tex          # Complete table of project abbreviations
│
├── chapters/                      # Main technical chapters
│   ├── chapter1_introduction.tex  # Problem background, motivation, objectives
│   ├── chapter2_literature_survey.tex # Authentic IEEE literature, comparative table
│   ├── chapter3_problem_definition.tex # Problem statement, constraints, methodology
│   ├── chapter4_srs.tex           # IEEE 830 functional & non-functional requirements
│   ├── chapter5_system_design.tex # Full TikZ diagrams (Architecture, DFD, UML, ER)
│   ├── chapter6_implementation.tex # Hardware, ESP32, Node.js, ML, React specifics
│   ├── chapter7_testing_results.tex # Vitest 101-test suite, calibration, ML metrics
│   ├── chapter8_specifications.tex # Advantages, limitations, applications, BOM cost
│   ├── chapter9_project_plan.tex  # Milestone table, WBS, TikZ Gantt chart
│   └── conclusion.tex             # Project synthesis and future scope
│
├── appendices/                    # Technical annexures & appendices
│   ├── hardware_details.tex       # ESP32 pinout table & transducer specifications
│   ├── code_snippets.tex          # Firmware Schmitt trigger, backend, ML trainer
│   ├── screenshots.tex            # Real prototype and visual analytics photos
│   ├── plagiarism_placeholder.tex # Annexure A: Anti-plagiarism certificate holder
│   └── sem1_activities.tex        # Annexure B: Completed Semester 1 project activities
│
└── figures/                       # Vector & high-resolution project images
    ├── kbt_logo.png               # Official KBTCOE college crest
    ├── sppu_logo.png              # Official Savitribai Phule Pune University crest
    ├── stepcharge-hero.jpg        # Physical smart floor tile harvester prototype
    ├── visual-hardware.jpg        # Hardware circuit and transducer integration
    ├── visual-energy-flow.jpg     # Real-time energy accumulation visual
    ├── visual-ai-classification.jpg # AI kinetic intensity classification feed
    └── visual-iot-network.jpg     # IoT edge-to-cloud telemetry topology
```

---

## 2. Compilation Instructions

This project is fully self-contained and compatible with **Tectonic**, **XeLaTeX**, **pdfLaTeX**, and **Overleaf**.

### Option A: Automated One-Line Build via Tectonic (Recommended)
Tectonic downloads all required packages automatically and executes the necessary BibTeX and cross-reference passes:
```bash
tectonic main.tex
```
Or from the workspace root:
```powershell
.\tectonic.exe StepCharge_AI_Report\main.tex
```

### Option B: Compiling with pdfLaTeX / XeLaTeX
Execute the standard academic two-pass sequence with BibTeX:
```bash
pdflatex main
bibtex main
pdflatex main
pdflatex main
```

### Option C: Uploading to Overleaf
1. Compress the entire `StepCharge_AI_Report/` folder into a `.zip` archive.
2. Log into [Overleaf](https://www.overleaf.com), select **New Project** $\rightarrow$ **Upload Project**, and upload the zip.
3. Set the compiler to **pdfLaTeX** or **XeLaTeX** in Overleaf Project Settings.
4. Click **Recompile**.

---

## 3. Placeholders Requiring Student Input

Before final university submission, please verify and replace the following bracketed placeholders:

| Placeholder | Location | Description |
| :--- | :--- | :--- |
| `[STUDENT NAME 1]` | `main.tex`, `titlepage.tex`, `certificate.tex`, `university_certificate.tex` | Full name of Student 1 |
| `[SEAT NO. 1]` | `titlepage.tex`, `certificate.tex`, `university_certificate.tex` | SPPU University Exam Seat Number |
| `[STUDENT NAME 2-4]` | `frontmatter/*.tex` | Full names of Students 2, 3, and 4 |
| `[SEAT NO. 2-4]` | `frontmatter/*.tex` | University Exam Seat Numbers |
| `[GUIDE NAME]` | `main.tex`, `titlepage.tex`, `certificate.tex` | Project Guide's Name (e.g., Prof. P. R. Pachorkar) |
| `[COORDINATOR NAME]` | `main.tex`, `certificate.tex` | Project Coordinator's Name |
| `on / / 2026` | `university_certificate.tex` | Date of preliminary project examination |
| Plagiarism Certificate | `appendices/plagiarism_placeholder.tex` | Attach official Turnitin/Urkund similarity sheet ($\le 15\%$) |
| Review Paper Receipt | `appendices/sem1_activities.tex` | Attach conference review paper receipt or presentation photos |

---

## 4. Technical Feature Verification Matrix

| Subsystem | Feature | Status | Verification Detail |
| :--- | :--- | :--- | :--- |
| **Hardware** | PZT-5 Ceramic Diaphragm Array | **Implemented** | 8 discs in $2\times 4$ matrix seated on silicone O-rings |
| **Hardware** | Full-Wave Schottky Rectifier | **Implemented** | 4$\times$ 1N5819 diodes ($V_F \approx 0.35\,\text{V}$) |
| **Hardware** | Overvoltage Clamping | **Implemented** | 5.1\,V Zener diode (1N4733A) protects storage buffer & ADC |
| **Hardware** | Supercapacitor Energy Storage | **Implemented** | 0.1\,F / 5.5\,V EDLC ($E = \frac{1}{2} C V^2$) |
| **Hardware** | Closed-Loop Demonstration Loads | **Implemented** | Logic-level MOSFETs (IRLZ44N) driving LED \& 5V DC fan |
| **Hardware** | Active Current Shunt (INA219) | **Planned (Sem 2)**| Stored energy estimated from voltage; current explicitly not guessed |
| **Firmware** | 16$\times$ Hardware Oversampling | **Implemented** | ESP32 ADC1 (GPIO 34 \& GPIO 35) oversampling noise rejection |
| **Firmware** | Exponential Moving Average (EMA) | **Implemented** | Low-pass software filtering with $\alpha = 0.25$ |
| **Firmware** | Dual-Threshold Schmitt Trigger | **Implemented** | Rising $V_{\text{high}} = 0.80\,\text{V}$, falling $V_{\text{low}} = 0.55\,\text{V}$ |
| **Firmware** | Refractory Lockout Timing | **Implemented** | 250\,ms window eliminates false mechanical double-triggering |
| **Firmware** | Pulse Duration Filter | **Implemented** | $60\,\text{ms} \le T_{\text{pulse}} \le 2000\,\text{ms}$ rejects noise and static weight |
| **Backend** | SHA-256 Device Key Authentication | **Implemented** | Secure `X-Device-Key` header with constant-time verification |
| **Backend** | Google OAuth 2.0 Sessions | **Implemented** | HttpOnly, SameSite, Secure JWT cookie session management |
| **Backend** | Role-Based Access Control (RBAC) | **Implemented** | Protected `USER` vs `ADMIN` routes |
| **Backend** | Automated Vitest Test Suite | **Implemented** | **101 of 101 tests passing** across 7 test suites |
| **Database** | MongoDB Atlas Time-Series Store | **Implemented** | Compound indexes on `{ deviceId: 1, timestamp: -1 }` |
| **Realtime** | Socket.IO Room Streaming | **Implemented** | Sub-100\,ms push updates to connected clients |
| **ML Service**| Random Forest Gait Classification | **Implemented** | 5 physical features ($V_{\text{pk}}, V_{\text{avg}}, T_p, \Delta T, V_s$) |
| **ML Service**| Subject-Independent Validation | **Implemented** | Stratified Group $K$-Fold by participant ID (**88.6\% accuracy**) |
| **Frontend** | React 19 + TypeScript Dashboard | **Implemented** | Real-time dials, time-series charts, AI feed, load feedback |
