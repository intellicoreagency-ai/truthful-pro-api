import type { ar } from './ar';

/**
 * ترجمة جزئية (روسي) لاختبار الخط والاتجاه مع لغة سيريلية.
 * المفاتيح الناقصة تعود إلى الإنجليزية ثم العربية. تُراجع بواسطة مترجم قبل الإطلاق.
 */
export const ru: Partial<Record<keyof typeof ar, string>> = {
  appName: 'Мохра',
  loginTitle: 'Добро пожаловать в Мохру',
  loginSub: 'Введите номер телефона, чтобы начать',
  phoneLabel: 'Номер телефона',
  hasWhatsapp: 'На этом номере есть WhatsApp',
  sendCode: 'Отправить код',
  tabHome: 'Главная',
  tabRequests: 'Заявки',
  tabSpecialists: 'Специалисты',
  tabProfile: 'Аккаунт',
  talkToMohra: 'Поговорить с Мохрой',
  greeting: 'Чем могу помочь сегодня?',
  statusIdle: 'Нажмите, чтобы говорить',
  statusListening: 'Слушаю…',
  statusThinking: 'Думаю…',
  statusSpeaking: 'Говорю…',
  stop: 'Стоп',
  quickTitle: 'Быстрый старт',
  quickCar: 'Сломалась машина',
  offersTitle: 'Предложения',
  choose: 'Выбрать это предложение',
  specialistsTitle: 'Специалисты',
  language: 'Язык',
};
