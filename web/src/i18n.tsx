import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type Lang = 'th' | 'en';

const dict: Record<Lang, Record<string, string>> = {
  th: {
    'app.name': 'Agency Care',
    'nav.dashboard': 'แดชบอร์ด',
    'nav.agency': 'Agency',
    'nav.employees': 'พนักงาน',
    'nav.plans': 'แผนเยี่ยม',
    'nav.posm': 'POSM',
    'nav.products': 'สินค้า',
    'nav.models': 'อุปกรณ์',
    'nav.route': 'เส้นทาง',
    'nav.scheduling': 'ตารางงาน',
    'nav.sellerPerf': 'ผลงานเซลส์',
    'nav.pipeline': 'Pipeline',
    'nav.kpi': 'KPI',
    'nav.autoassign': 'จัดทีม',
    'nav.ai': 'AI',
    'nav.myWork': 'งานของฉัน',
    'nav.myDay': 'ตารางของฉัน',
    'nav.users': 'ผู้ใช้',
    'common.logout': 'ออก',
    'common.save': 'บันทึก',
    'common.cancel': 'ยกเลิก',
    'common.add': 'เพิ่ม',
    'common.edit': 'แก้ไข',
    'page.dashboard': 'แดชบอร์ด',
    'page.agencies': 'Master Agency',
    'page.employees': 'พนักงาน / เซลส์',
    'page.scheduling': 'ตารางงาน & ทีม',
    'page.sellerPerf': 'Seller Performance',
    'page.pipeline': 'Agency Pipeline',
    'page.kpi': 'KPI ประสิทธิภาพเซลส์',
    'page.autoassign': 'จัดทีมอัตโนมัติ (AI)',
    'page.myDay': 'ตารางของฉัน',
    'page.analytics': 'AI Analytics',
    'login.title': 'เข้าสู่ระบบ',
    'login.subtitle': 'Agency Care — ระบบดูแลเอเจนซี่ภาคสนาม',
    'login.email': 'อีเมล',
    'login.password': 'รหัสผ่าน',
    'login.submit': 'เข้าสู่ระบบ',
  },
  en: {
    'app.name': 'Agency Care',
    'nav.dashboard': 'Dashboard',
    'nav.agency': 'Agencies',
    'nav.employees': 'Staff',
    'nav.plans': 'Visit Plans',
    'nav.posm': 'POSM',
    'nav.products': 'Products',
    'nav.models': 'Equipment',
    'nav.route': 'Route',
    'nav.scheduling': 'Schedule',
    'nav.sellerPerf': 'Performance',
    'nav.pipeline': 'Pipeline',
    'nav.kpi': 'KPI',
    'nav.autoassign': 'Auto-assign',
    'nav.ai': 'AI',
    'nav.myWork': 'My Work',
    'nav.myDay': 'My Day',
    'nav.users': 'Users',
    'common.logout': 'Logout',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.add': 'Add',
    'common.edit': 'Edit',
    'page.dashboard': 'Dashboard',
    'page.agencies': 'Master Agency',
    'page.employees': 'Staff / Sales',
    'page.scheduling': 'Schedule & Teams',
    'page.sellerPerf': 'Seller Performance',
    'page.pipeline': 'Agency Pipeline',
    'page.kpi': 'Seller KPI',
    'page.autoassign': 'Auto Team Assignment (AI)',
    'page.myDay': 'My Day',
    'page.analytics': 'AI Analytics',
    'login.title': 'Sign in',
    'login.subtitle': 'Agency Care — Field agency management',
    'login.email': 'Email',
    'login.password': 'Password',
    'login.submit': 'Sign in',
  },
};

interface I18nCtx {
  lang: Lang;
  t: (key: string) => string;
  setLang: (l: Lang) => void;
}
const Ctx = createContext<I18nCtx>({ lang: 'th', t: (k) => k, setLang: () => {} });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem('lang') as Lang) || 'th');
  const value = useMemo<I18nCtx>(
    () => ({
      lang,
      setLang: (l) => {
        localStorage.setItem('lang', l);
        setLangState(l);
      },
      t: (key) => dict[lang][key] ?? dict.th[key] ?? key,
    }),
    [lang],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useT = () => useContext(Ctx);
