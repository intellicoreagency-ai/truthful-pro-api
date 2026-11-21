/**
 * Main-service and branch names in Russian, Chinese (Simplified), French and Spanish.
 * Authority names follow their usual official renderings (MOHRE, FTA, RTA).
 */
import type {Extra} from '../i18n';

type Four=Record<Extra,string>;
const f=(ru:string,zh:string,fr:string,es:string):Four=>({ru,zh,fr,es});

export const CATEGORY_TR:Record<string,{title:Four;desc:Four}>={
  residency:{title:f('ВНЖ и визы','居留与签证','Résidence et visas','Residencia y visados'),
    desc:f('Оформление и продление ВНЖ, виз и паспортные вопросы','办理与续签居留、签证及护照事务','Délivrance et renouvellement des résidences, visas et passeports','Expedición y renovación de residencias, visados y pasaportes')},
  'emirates-id':{title:f('Emirates ID','阿联酋身份证','Emirates ID','Emirates ID'),
    desc:f('Выпуск, продление и обновление Emirates ID','办理、续签和更新阿联酋身份证','Délivrance, renouvellement et mise à jour de l’Emirates ID','Expedición, renovación y actualización de su Emirates ID')},
  business:{title:f('Открытие компании и торговые лицензии','公司设立与营业执照','Création de société et licences','Constitución de empresas y licencias'),
    desc:f('Регистрация компаний, выдача, продление и изменение лицензий','注册公司，办理、续期和变更执照','Créer une société, obtenir, renouveler et modifier les licences','Constituir empresas y emitir, renovar y modificar licencias')},
  labour:{title:f('Персонал и трудовые вопросы','人力资源与劳工','Ressources humaines et travail','Recursos humanos y trabajo'),
    desc:f('Министерство людских ресурсов и эмиратизации (MOHRE)','人力资源和本土化部 (MOHRE)','Ministère des Ressources humaines et de l’Émiratisation (MOHRE)','Ministerio de Recursos Humanos y Emiratización (MOHRE)')},
  ejari:{title:f('Ejari','Ejari 租约登记','Ejari','Ejari'),
    desc:f('Регистрация, продление и расторжение договоров аренды','登记、续签和注销租赁合同','Enregistrer, renouveler et résilier les baux','Registrar, renovar y cancelar contratos de alquiler')},
  notary:{title:f('Нотариус','公证','Notaire','Notaría'),
    desc:f('Доверенности, заявления и нотариальное заверение','授权书、声明及公证','Procurations, déclarations et actes notariés','Poderes, declaraciones y legalizaciones notariales')},
  courts:{title:f('Суды и юридические услуги','法院与法律服务','Tribunaux et services juridiques','Tribunales y servicios jurídicos'),
    desc:f('Сопровождение дел и заявлений в судах','跟进法院案件和申请','Suivi des affaires et requêtes auprès des tribunaux','Seguimiento de casos y solicitudes ante los tribunales')},
  translation:{title:f('Юридический перевод','法律翻译','Traduction juridique','Traducción jurídica'),
    desc:f('Заверенный перевод официальных документов','官方文件认证翻译','Traduction certifiée de documents officiels','Traducción certificada de documentos oficiales')},
  attestation:{title:f('Легализация документов','文件认证','Légalisation de documents','Legalización de documentos'),
    desc:f('Легализация дипломов и документов в компетентных органах','向主管部门认证证书和文件','Légalisation des diplômes et documents auprès des autorités','Legalización de títulos y documentos ante las autoridades')},
  rta:{title:f('Управление дорог и транспорта','道路交通管理局','Autorité des routes et des transports','Autoridad de Carreteras y Transporte'),
    desc:f('Автомобили и водительские удостоверения (RTA)','车辆与驾照业务 (RTA)','Véhicules et permis (RTA)','Vehículos y permisos de conducir (RTA)')},
  tax:{title:f('Налоги','税务','Fiscalité','Impuestos'),
    desc:f('Регистрация по корпоративному налогу','企业所得税登记','Inscription à l’impôt sur les sociétés','Registro del impuesto de sociedades')},
  bank:{title:f('Банковские счета','银行账户','Comptes bancaires','Cuentas bancarias'),
    desc:f('Подготовка пакета для открытия счёта компании','准备公司开户材料','Préparation du dossier d’ouverture de compte','Preparación del expediente de apertura de cuenta')},
  customs:{title:f('Таможня','海关','Douanes','Aduanas'),
    desc:f('Таможенная регистрация и связанные операции','海关登记及相关业务','Enregistrement douanier et démarches associées','Registro aduanero y trámites relacionados')},
};

export const BRANCH_TR:Record<string,{title:Four;desc:Four}>={
  'residency-individuals':{title:f('ВНЖ','居留','Résidence','Residencia'),desc:f('Выпуск, продление и аннулирование ВНЖ','办理、续签和注销居留','Délivrance, renouvellement et annulation','Expedición, renovación y cancelación')},
  'family-sponsorship':{title:f('Спонсорство семьи','家庭担保','Parrainage familial','Patrocinio familiar'),desc:f('Супруг(а), дети и родители','担保配偶、子女和父母','Conjoint, enfants et parents','Cónyuge, hijos y padres')},
  'residency-fines':{title:f('Штрафы по ВНЖ','居留罚款','Amendes de résidence','Multas de residencia'),desc:f('Проверка штрафов и варианты урегулирования','查询罚款及处理方案','Vérifier les amendes et les options de règlement','Consultar multas y opciones de regularización')},
  'immigration-visas':{title:f('Визы и ВНЖ сотрудников','员工签证与居留','Visas et résidence des employés','Visados y residencia de empleados'),desc:f('Рабочие визы, ВНЖ и паспорта сотрудников','工作签证、居留及员工护照事务','Visas de travail, résidence et passeports','Visados de trabajo, residencia y pasaportes')},
  'emirates-id':{title:f('Emirates ID','阿联酋身份证','Emirates ID','Emirates ID'),desc:f('Выпуск, продление, замена и обновление','办理、续签、补办和更新','Délivrance, renouvellement, remplacement, mise à jour','Expedición, renovación, reposición y actualización')},
  'company-formation':{title:f('Открытие компании','公司设立','Création de société','Constitución de empresa'),desc:f('Правовая форма, вид деятельности и регистрация','法律形式、经营活动与注册','Forme juridique, activité et immatriculation','Forma jurídica, actividad y registro')},
  'trade-licenses':{title:f('Торговая лицензия','营业执照','Licence commerciale','Licencia comercial'),desc:f('Выдача, продление и изменение лицензии и устава','办理、续期和变更执照及公司章程','Délivrance, renouvellement, modification et statuts','Expedición, renovación, modificación y estatutos')},
  'mohre-company-registration':{title:f('Регистрация предприятия','机构注册','Enregistrement de l’établissement','Registro del establecimiento'),desc:f('Регистрация и обновление данных в MOHRE','在 MOHRE 注册并更新资料','Enregistrement et mise à jour auprès du MOHRE','Registro y actualización ante el MOHRE')},
  'labor-employment':{title:f('Трудовые договоры и разрешения','劳动合同与工作许可','Contrats et permis de travail','Contratos y permisos de trabajo'),desc:f('Трудовые договоры, разрешения и вопросы персонала','劳动合同、工作许可及员工事务','Contrats, permis et questions du personnel','Contratos, permisos y asuntos del personal')},
  'wage-protection':{title:f('Система защиты зарплат (WPS)','工资保护系统 (WPS)','Système de protection des salaires (WPS)','Sistema de protección salarial (WPS)'),desc:f('Подключение и контроль выплат','注册并确保工资合规','Adhésion et conformité des salaires','Alta y cumplimiento de los salarios')},
  'ejari-individuals':{title:f('Жилой Ejari','住宅 Ejari','Ejari résidentiel','Ejari residencial'),desc:f('Регистрация, продление и расторжение аренды жилья','登记、续签和注销住宅租约','Bail résidentiel : enregistrement, renouvellement, résiliation','Alquiler residencial: registro, renovación y cancelación')},
  'commercial-ejari':{title:f('Коммерческий Ejari','商业 Ejari','Ejari commercial','Ejari comercial'),desc:f('Аренда офиса компании для лицензии','用于执照的公司场所租约','Bail des locaux de la société pour la licence','Alquiler del local de la empresa para la licencia')},
  'notary-individuals':{title:f('Нотариус для частных лиц','个人公证','Notaire pour particuliers','Notaría para particulares'),desc:f('Личные доверенности и заявления','个人授权书和声明','Procurations et déclarations personnelles','Poderes y declaraciones personales')},
  'notary-companies':{title:f('Нотариус для компаний','企业公证','Notaire pour entreprises','Notaría para empresas'),desc:f('Доверенности компании и решения участников','公司授权书和股东决议','Procurations et décisions des associés','Poderes y acuerdos de socios')},
  'courts-individuals':{title:f('Судебные услуги для частных лиц','个人诉讼服务','Services judiciaires pour particuliers','Servicios judiciales para particulares'),desc:f('Подача заявлений и сопровождение дел','提交申请并跟进案件','Dépôt de requêtes et suivi des affaires','Presentación de solicitudes y seguimiento')},
  'courts-legal-companies':{title:f('Судебные услуги для компаний','企业诉讼服务','Services judiciaires pour entreprises','Servicios judiciales para empresas'),desc:f('Коммерческие и трудовые дела компаний','企业商事及劳动案件','Affaires commerciales et sociales','Casos mercantiles y laborales')},
  'legal-translation-individuals':{title:f('Личные документы','个人文件','Documents personnels','Documentos personales'),desc:f('Свидетельства, договоры и личные документы','证书、合同及个人文件','Actes, contrats et pièces personnelles','Certificados, contratos y documentos personales')},
  'legal-translation-companies':{title:f('Документы компании','企业文件','Documents de société','Documentos de empresa'),desc:f('Договоры, лицензии и документы компании','合同、执照及公司文件','Contrats, licences et documents de la société','Contratos, licencias y documentos de la empresa')},
  'attestation-individuals':{title:f('Легализация документов','文件认证','Légalisation de documents','Legalización de documentos'),desc:f('Дипломы, семейные и официальные документы','学历、家庭及官方文件','Diplômes, actes familiaux et documents officiels','Títulos, documentos familiares y oficiales')},
  'rta-individuals':{title:f('Для частных лиц','个人业务','Démarches des particuliers','Trámites de particulares'),desc:f('Регистрация авто и водительские права','车辆登记与驾照','Immatriculation et permis de conduire','Matriculación y permisos de conducir')},
  'rta-companies':{title:f('Для компаний','企业业务','Démarches des entreprises','Trámites de empresas'),desc:f('Автомобили и разрешения компании','公司车辆及许可','Véhicules et autorisations de la société','Vehículos y permisos de la empresa')},
  'corporate-tax':{title:f('Корпоративный налог','企业所得税','Impôt sur les sociétés','Impuesto de sociedades'),desc:f('Регистрация в Федеральной налоговой службе','在联邦税务局登记','Inscription auprès de l’Autorité fiscale fédérale','Registro ante la Autoridad Tributaria Federal')},
  'bank-account':{title:f('Открытие счёта компании','公司开户','Ouverture de compte société','Apertura de cuenta empresarial'),desc:f('Подготовка документов и сопровождение заявки','准备文件并跟进银行申请','Préparation des pièces et suivi de la demande','Preparación de documentos y seguimiento')},
  customs:{title:f('Таможенные услуги','海关服务','Services douaniers','Servicios aduaneros'),desc:f('Таможенный код и регистрация','海关编码与登记','Code douanier et enregistrement','Código aduanero y registro')},
};
