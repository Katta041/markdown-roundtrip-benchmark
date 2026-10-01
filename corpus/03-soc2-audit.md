SOC 2 Type II Readiness Assessment
==================================

**Organisation:** Northwind Cloud Pte Ltd   
**Period:** 1 Mar 2026 to 31 Aug 2026	
**Trust Services Criteria:** Security, Availability, Confidentiality

---

## 1. Summary of results

Of **64 controls** tested, 52 operated effectively, 9 had exceptions and 3 were not tested.

## 2. Control matrix

| Control ID | TSC | Control description | Test performed | Sample | Exceptions | Result | Owner |
| :--- | :---: | --- | --- | ---: | ---: | :---: | --- |
| CC1.1 | CC1 | Code of conduct acknowledged annually | Inspected HR system export | 25 | 0 | Pass | HR |
| CC2.2 | CC2 | Security awareness training within 30 days of hire | Inspected LMS records | 25 | 3 | **Exception** | HR |
| CC6.1 | CC6 | MFA enforced for production access | Inspected IdP policy + 10 login logs | 10 | 0 | Pass | IT |
| CC6.2 | CC6 | Access provisioning approved by manager | Ticket sample | 40 | 2 | **Exception** | IT |
| CC6.3 | CC6 | Quarterly access reviews | Inspected Q1, Q2 reviews | 2 | 1 | **Exception** | IT |
| CC7.2 | CC7 | Security events monitored 24x7 | SIEM alert sample | 30 | 0 | Pass | SecOps |
| CC8.1 | CC8 | Changes peer reviewed before merge | PR sample from `main` | 60 | 4 | **Exception** | Eng |
| A1.2 | A1 | Backups tested quarterly | Restore test evidence | 2 | 0 | Pass | SRE |
| C1.1 | C1 | Confidential data encrypted at rest (AES-256) | KMS config inspection | n/a | 0 | Pass | SRE |
| C1.2 | C1 | Data disposal within 30 days of contract end | Disposal certificates | 5 | 1 | Exception | Legal |

## 3. Exceptions detail

### 3.1 CC2.2 Security awareness training

1. Three of 25 new hires completed training after 30 days (41, 45, 62 days).
2. Root cause: LMS enrolment was manual for contractors.

    Management response: automate enrolment via the HRIS webhook by 30 Oct 2026.

3. Auditor note: re-test in Q4.

### 3.2 CC8.1 Change management

* 4 of 60 PRs merged with admin override:
	* `#8812` hotfix during incident INC-2291 (documented)
	* `#8840`, `#8851`, `#8903` no documented justification
* Branch protection allowed admins to bypass.

Remediation plan:

- [x] Remove admin bypass on `main` (done 2026-09-02)
- [ ] Add break-glass procedure with post-hoc review
- [ ] Monthly report of override merges to the CISO

## 4. Evidence index

| Ref | Evidence | Location |
|---|---|---|
| E-01 | HR export `hr_ack_2026.csv` | `evidence/cc1/` |
| E-02 | IdP MFA policy screenshot | `evidence/cc6/mfa.png` |
| E-03 | PR sample list | `evidence/cc8/pr_sample.xlsx` |

![MFA policy screenshot](evidence/cc6/mfa.png "Okta MFA policy, captured 2026-08-14")

## 5. Next steps		

- Schedule Type II fieldwork for **January 2027**.
- Close all *exceptions* before **15 Dec 2026**.
- Engage auditor for bridge letter.   

---

*Prepared by Assurance Team. Draft v0.3, not for external distribution.*
