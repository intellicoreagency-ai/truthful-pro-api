/**
 * Estimated price ranges shown on a service page BEFORE the customer starts a request.
 *
 * Owner rule (21 Nov 2026): actual fees are NOT adopted until the owner approves them, and no dummy or placeholder
 * price may appear in the customer app. A service therefore shows a range only when it has an entry here with the
 * owner's approval recorded. Every other service explains how pricing works instead (a written quotation, with
 * government fees and TRUTHFUL's fee shown separately, approved by the customer before any payment).
 *
 * To publish a range: add an entry with the owner's name and the approval date, amounts in whole AED.
 *   'immigration-visas': {government:[300,1200],service:[150,400],approvedBy:'Owner name',approvedOn:'2026-12-01'},
 */
export type PriceRange=readonly [min:number,max:number];
export type PriceGuide={government?:PriceRange;service?:PriceRange;approvedBy:string;approvedOn:string};

export const PRICE_GUIDE:Readonly<Record<string,PriceGuide>>={
  // No ranges approved yet.
};

export const priceGuideFor=(serviceId:string):PriceGuide|undefined=>PRICE_GUIDE[serviceId];

/** "300 – 1,200" in Latin digits (amounts stay left-to-right inside Arabic text). */
export const formatRange=([min,max]:PriceRange)=>min===max?min.toLocaleString('en-US'):`${min.toLocaleString('en-US')} – ${max.toLocaleString('en-US')}`;
