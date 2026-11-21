/**
 * Photo halves of the owner-approved service artwork (cropped from assets/approved_banners and
 * assets/company_redesign, the text side removed), one per public service. The navy & gold banner draws
 * its own text, icon and wave over the seam, so the same photo serves Arabic and English.
 */
import type {ImageSourcePropType} from 'react-native';

export const BANNER_PHOTOS:Record<string,ImageSourcePropType>={
  'residency-individuals':require('../../assets/banner_photos/residency-individuals.webp'),
  'family-sponsorship':require('../../assets/banner_photos/family-sponsorship.webp'),
  'residency-fines':require('../../assets/banner_photos/residency-fines.webp'),
  'immigration-visas':require('../../assets/banner_photos/immigration-visas.webp'),
  'emirates-id':require('../../assets/banner_photos/emirates-id.webp'),
  'company-formation':require('../../assets/banner_photos/company-formation.webp'),
  'trade-licenses':require('../../assets/banner_photos/trade-licenses.webp'),
  'mohre-company-registration':require('../../assets/banner_photos/mohre-company-registration.webp'),
  'labor-employment':require('../../assets/banner_photos/labor-employment.webp'),
  'wage-protection':require('../../assets/banner_photos/wage-protection.webp'),
  'ejari-individuals':require('../../assets/banner_photos/ejari-individuals.webp'),
  'commercial-ejari':require('../../assets/banner_photos/commercial-ejari.webp'),
  'notary-individuals':require('../../assets/banner_photos/notary-individuals.webp'),
  'notary-companies':require('../../assets/banner_photos/notary-companies.webp'),
  'courts-individuals':require('../../assets/banner_photos/courts-individuals.webp'),
  'courts-legal-companies':require('../../assets/banner_photos/courts-legal-companies.webp'),
  'legal-translation-individuals':require('../../assets/banner_photos/legal-translation-individuals.webp'),
  'legal-translation-companies':require('../../assets/banner_photos/legal-translation-companies.webp'),
  'attestation-individuals':require('../../assets/banner_photos/attestation-individuals.webp'),
  'rta-individuals':require('../../assets/banner_photos/rta-individuals.webp'),
  'rta-companies':require('../../assets/banner_photos/rta-companies.webp'),
  'corporate-tax':require('../../assets/banner_photos/corporate-tax.webp'),
  'bank-account':require('../../assets/banner_photos/bank-account.webp'),
  'customs':require('../../assets/banner_photos/customs.webp'),
};
