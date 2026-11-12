/* ตั้งค่าการเข้าสู่ระบบ Microsoft 365 ของเว็บ static (ไม่มีความลับในไฟล์นี้ — client/tenant/group ID เปิดเผยได้)
   ใช้ App registration เดิม "CCC Staff Status Login" (ใช้ร่วมกับเว็บอื่นของบริษัท) — ไม่ต้องสร้าง App ใหม่
   และไม่เปิด Assignment required เพราะจะกระทบเว็บอื่น · ต้องเพิ่ม Redirect URI ของ repo นี้ใน App (Authentication → SPA) */
window.DASH_AUTH = {
  clientId: '75b5084b-4823-4a13-bb79-d47af910fb21',
  tenantId: '54cf0b45-7b5b-41b0-bbeb-dddef5eae512',
  groupId: 'b41f37a8-a4b6-4fd9-b1c7-accdcd508e05',
  groupName: 'stg_dashboard_viewers',
  // ลิงก์แชร์ไฟล์กุญแจใน SharePoint (แชร์เฉพาะ stg_dashboard_viewers สิทธิ์ View) (ตั้งค่าแล้ว 12 พ.ย. 2569)
  keyShareUrl: 'https://sevenutilitiesandpower.sharepoint.com/:t:/g/IQB2a6mDobxCQZjzzUpszpNtAZoYtOuzKG8TRQNzGwIvxWo?e=KN1jFl',
  // redirectUri: 'https://<owner>.github.io/<repo>/',   // ไม่ใส่ = ใช้ URL ของหน้าเว็บเอง
};
