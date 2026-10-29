# MWA Mahasawat Filter Media Replenishment & Hydraulic Design Model
**ระบบคำนวณการเติมสารกรองและวิเคราะห์สมรรถนะบ่อกรอง โรงงานผลิตน้ำมหาสวัสดิ์ (การประปานครหลวง - กปน.)**

Web Application สำหรับวิศวกรและผู้ปฏิบัติงานโรงงานผลิตน้ำมหาสวัสดิ์ ใช้ในการประเมินสภาพสารกรองปัจจุบัน (ขนาดประสิทธิผล $ES / d_{10}$, สัมประสิทธิ์ความสม่ำเสมอ $UC = d_{60}/d_{10}$, และระดับความลึก $L$) เพื่อคำนวณปริมาณและสเปกของสารกรองที่ต้องเติมเพิ่มหรือปรับปรุงให้ได้ตามเกณฑ์การออกแบบ (Design Criteria) และหลักวิชาการสากล

---

## 1. ข้อมูลจำเพาะบ่อกรองโรงงานผลิตน้ำมหาสวัสดิ์ (Design Specifications)

| โครงการ / เฟส | ประเภทบ่อกรอง | จำนวนและพื้นที่ต่อบ่อ | ชั้นสารกรอง (Media Layer) | ความลึก Design ($L$) | ขนาดประสิทธิผล ($ES, d_{10}$) | สัมประสิทธิ์ความสม่ำเสมอ ($UC$) | ค่า $\sum (L/d_{10})$ | อัตราการกรอง ($v_F$) |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **เฟส 1 & 2** | Aquazur "V" (Single-Media) | 16 บ่อ ($197.8\text{ m}^2$/บ่อ) | ทราย (Silica Sand) | $1.20\text{ m}$ | $0.90\text{–}1.00\text{ mm}$ ($0.95\text{ mm}$) | $1.40$ | $1,263$ | $11.0\text{ m/h}$ (สูงสุด $12.57\text{ m/h}$) |
| **เฟส 3** | SG/OTV Dual-Media | 14 บ่อ ($112.0\text{ m}^2$/บ่อ) | • Anthracite<br>• Silica Sand<br>• Gravel | $0.80\text{ m}$<br>$0.70\text{ m}$<br>$0.20\text{ m}$ | $1.55\text{ mm}$<br>$0.90\text{–}1.00\text{ mm}$<br>- | $1.50$<br>$1.50$<br>- | $516 + 737 = 1,253$ | $11.1\text{ m/h}$ (สูงสุด $12.0\text{ m/h}$) |
| **เฟส 4** | ITA Dual-Media | 14 บ่อ ($111.6\text{ m}^2$/บ่อ) | • Anthracite<br>• Silica Sand<br>• Gravel | $0.60\text{ m}$<br>$0.60\text{ m}$<br>$0.20\text{ m}$ | $1.30\text{ mm}$<br>$0.66\text{ mm}$<br>- | $1.40$<br>$1.50$<br>- | $462 + 909 = 1,371$ | $11.0\text{ m/h}$ (สูงสุด $11.8\text{ m/h}$) |

---

## 2. ความสามารถหลักของโมเดลคำนวณ (Key Features)

1. **รองรับการสุ่มเก็บตัวอย่างหลายตำแหน่งและหลายระดับความลึก (Random Multi-Point & Multi-Depth Sampling Aggregator)**
   - คำนวณค่าตัวแทนรวมของชั้นสารกรอง ($ES_{\text{composite}}, UC_{\text{composite}}$ และความลึกเฉลี่ย $\bar{L} \pm \text{SD}$) จากข้อมูลที่สุ่มเก็บหลายจุดในบ่อด้วยสมการการผสมการกระจายตัวแบบ **Log-Normal Mixture Distribution**

2. **เปรียบเทียบการเติมสารกรองครบทั้ง 3 แนวทาง (3 Replenishment Approaches)**
   - **แนวทางที่ 1 (ก): เติมสารกรองตามสเปก Design ให้ได้ระดับความลึกเดิม (+ วิเคราะห์การปาดเปลี่ยน Skimming/Replacement)**
     คำนวณว่าเมื่อเติมสารกรองสเปก Design ทับลงไปให้ได้ความลึก $L_{\text{design}}$ ค่า $ES_{\text{mix}}$ และ $UC_{\text{mix}}$ จะอยู่ในเกณฑ์ยอมรับได้หรือไม่ หากไม่อยู่ในเกณฑ์ ระบบจะคำนวณความลึกของสารกรองเดิมที่ต้องปาดออก ($L_{\text{remove}}$) และปริมาณที่ต้องเติมใหม่ทั้งหมด
   - **แนวทางที่ 2 (ข): คำนวณสเปกสารกรองใหม่ ($ES_{\text{new}}, UC_{\text{new}}$) เพื่อผสม (Custom Blend)**
     คำนวณย้อนกลับ (Inverse Log-Normal Mixture Optimization) เพื่อหาว่าควรสั่งซื้อสารกรองล็อตใหม่ที่มีค่า $ES_{\text{new}}$ และ $UC_{\text{new}}$ เท่าใด เพื่อเติมทับของเดิมแล้วดึงให้ค่าเฉลี่ยรวมของทั้งบ่อกลับมาตรงตาม Design
   - **แนวทางที่ 3 (ค): ปรับระดับความลึกชดเชยตามสัดส่วนดัชนีสมรรถนะการกรอง ($L/d_e$ Ratio Equivalence)**
     คำนวณความลึกที่ต้องเติมเพื่อให้ค่าดัชนี $\sum (L/d_{10})$ เทียบเท่ากับ Design เดิมเพื่อชดเชยขนาด $ES$ ที่เปลี่ยนไป

3. **เครื่องมือคำนวณย้อนกลับหาค่า $ES$, ความลึก $L$, $UC$ และ Filtration Rate ที่เหมาะสม (Reverse Design Solver)**
   - สามารถกรอก **ระดับความลึก ($L$)**, **ค่า $UC$**, และ **Filtration Rate ($v_F$ เช่น $10\text{–}12\text{ m/h}$)** เพื่อคำนวณหา **ขนาด $ES (d_{10})$ ที่เหมาะสมที่สุด** พร้อมกราฟสมดุลระยะเวลาเดินบ่อ ($t_B$ vs $t_{HL}$ ตาม MWH Fig. 11-13)
   - หรือกรอก **ขนาด $ES$ และ $UC$** เพื่อหา **ความลึกชั้นสารกรอง ($L$) ที่เหมาะสม**

4. **วิเคราะห์ไฮดรอลิกส์การล้างย้อนและสาเหตุที่สารกรองหลุดหาย (Backwash & Media Washout Diagnostics)**
   - คำนวณความเร็วการลอยตัวต่ำสุด $V_{mf}(d_{60}), V_{mf}(d_{90})$ ตามสมการ *Wen & Yu (1966)*
   - คำนวณการขยายตัวของชั้นสารกรอง (% Bed Expansion) ตามสมการ *Dharmarajah & Cleasby (1986)*
   - วิเคราะห์สภาวะการเป่าลมพร้อมน้ำล้างย้อน (*Collapse-Pulsing*, *Amirtharajah, 1984*) และความเสี่ยงการพัดพาเม็ดสารกรองหลุดออกทางรางน้ำล้างย้อน

5. **ตารางสรุปแผนจัดซื้อรวมหลายบ่อ (Multi-Filter Batch Summary & Export CSV/PDF)**
   - รวมยอดปริมาตรสุทธิ ($\text{m}^3$), ปริมาตรสั่งซื้อรวมเผื่อการปาดผิวและยุบตัว (Skimming & Compaction Allowance), น้ำหนักรวม (ตัน) และจำนวนถุง Big Bag พร้อมส่งออกไฟล์ CSV/Excel และพิมพ์รายงาน PDF

---

## 3. เอกสารอ้างอิงทางวิชาการ (Academic References)

1. Crittenden, J. C., Trussell, R. R., Hand, D. W., Howe, K. J., & Tchobanoglous, G. (2012). *MWH's Water Treatment: Principles and Design* (3rd ed.). John Wiley & Sons. (Chapter 11: Granular Filtration).
2. Edzwald, J. K. (Ed.). (2011). *Water Quality & Treatment: A Handbook on Drinking Water* (6th ed.). AWWA / McGraw-Hill. (Chapter 10: Granular Media Filtration).
3. Benjamin, M. M., & Lawler, D. F. (2013). *Water Quality Engineering: Physical / Chemical Treatment Processes*. John Wiley & Sons. (Chapter 14: Granular Media Filtration).
4. American Water Works Association (2011). *AWWA Manual M37: Operational Control of Coagulation and Filtration Processes* (3rd ed.).
5. Kawamura, S. (2000). *Integrated Design and Operation of Water Treatment Facilities* (2nd ed.). John Wiley & Sons.
6. เอกสารคู่มือการออกแบบโรงงานผลิตน้ำมหาสวัสดิ์ การประปานครหลวง (Maha Sawat Water Treatment Plant Design Manuals: Phase 1 & 2 Aquazur "V", Phase 3 SG/OTV Consortium, Phase 4 ITA Consortium).
