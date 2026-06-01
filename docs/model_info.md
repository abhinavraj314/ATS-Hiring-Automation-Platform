# Model Information

## Production Model

**Model Name:** domain_model_v1

**Status:** Frozen (Phase 2 Baseline)

**Model Type:** SentenceTransformer

**Similarity Function:** Cosine Similarity

---

## Architecture

### Core Components

1. Transformer Encoder
2. Pooling Layer
3. Normalization Layer

### Module Pipeline

Transformer
→ Pooling
→ Normalize

### Framework Versions

| Component             | Version    |
| --------------------- | ---------- |
| PyTorch               | 2.12.0+cpu |
| Sentence Transformers | 5.5.1      |
| Transformers          | 5.9.0      |

---

## Training Configuration

### Base Model

sentence-transformers/all-MiniLM-L6-v2

### Fine-Tuning Strategy

Multiple Negatives Ranking Loss (MNRL)

### Training Dataset

| Metric                      | Value |
| --------------------------- | ----- |
| Job Descriptions            | 23    |
| Candidate Resumes           | 8     |
| Generated Training Triplets | 46    |

---

## Supported Domains

* Microsoft Power Apps
* Microsoft Power Platform
* Power Automate
* Dataverse
* Oracle PBCS
* Oracle EPBCS
* Oracle FCCS
* Oracle TRCS
* Oracle EPM
* CCH Tagetik
* Enterprise Performance Management
* Finance Transformation

---

## Embedding Infrastructure

| Component                 | Count |
| ------------------------- | ----- |
| Job Embeddings            | 23    |
| Candidate Embeddings      | 8     |
| CandidateJobMatch Records | 8     |

---

## Model Registry

Location:

ai_experiments/model_registry/domain_model_v1

---

## Model Size

| Metric       | Value      |
| ------------ | ---------- |
| Size (MB)    | 86.65 MB   |
| Size (Bytes) | 90,864,192 |

---

## Phase 2 Freeze Information

This model is designated as the official Phase 2 production baseline.

Future improvements must be versioned separately:

* domain_model_v2
* domain_model_v3

No further retraining is planned for Phase 2.

Freeze Date: June 2026
