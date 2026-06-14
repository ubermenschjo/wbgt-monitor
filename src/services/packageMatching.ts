import {
  PACKAGE_TYPE,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';

import {
  PACKAGE_ID_ALIASES,
  STORE_PRODUCT_ALIASES,
  type PlanId,
} from './subscriptionConstants';

export function productMatchesPlan(
  productId: string,
  plan: PlanId,
): boolean {
  if (STORE_PRODUCT_ALIASES[plan].includes(productId)) {
    return true;
  }
  return STORE_PRODUCT_ALIASES[plan].some((baseId) =>
    productId.startsWith(`${baseId}:`),
  );
}

export function planFromProductId(productId: string): PlanId | null {
  const plans: PlanId[] = ['lite', 'standard', 'enterprise'];
  for (const plan of plans) {
    if (productMatchesPlan(productId, plan)) {
      return plan;
    }
  }
  return null;
}

function packageTypeMatchesPlan(
  pkg: PurchasesPackage,
  plan: PlanId,
): boolean {
  if (plan === 'lite' || plan === 'standard' || plan === 'enterprise') {
    return (
      pkg.packageType === PACKAGE_TYPE.MONTHLY ||
      pkg.packageType === PACKAGE_TYPE.ANNUAL
    );
  }
  return false;
}

export function findOfferingPackage(
  offering: PurchasesOffering | null,
  plan: PlanId,
): PurchasesPackage | null {
  if (!offering) {
    return null;
  }

  // RevenueCat ダッシュボードの Package 種類（Monthly / Annual）を最優先
  if (offering.monthly && productMatchesPlan(offering.monthly.product.identifier, plan)) {
    return offering.monthly;
  }
  if (offering.annual && productMatchesPlan(offering.annual.product.identifier, plan)) {
    return offering.annual;
  }

  const packages = offering.availablePackages ?? [];
  if (!packages.length) {
    return null;
  }

  for (const alias of STORE_PRODUCT_ALIASES[plan]) {
    const match = packages.find((pkg) => pkg.product.identifier === alias);
    if (match) {
      return match;
    }
  }

  const colonMatch = packages.find((pkg) =>
    productMatchesPlan(pkg.product.identifier, plan),
  );
  if (colonMatch) {
    return colonMatch;
  }

  for (const alias of PACKAGE_ID_ALIASES[plan]) {
    const match = packages.find((pkg) => pkg.identifier === alias);
    if (match) {
      return match;
    }
  }

  const byType = packages.filter((pkg) => packageTypeMatchesPlan(pkg, plan));
  if (byType.length === 1) {
    return byType[0] ?? null;
  }
  if (byType.length > 1) {
    return (
      byType.find((pkg) => productMatchesPlan(pkg.product.identifier, plan)) ??
      byType[0] ??
      null
    );
  }

  return null;
}

export function findOfferingPackageByProductId(
  offering: PurchasesOffering | null,
  productId: string,
): PurchasesPackage | null {
  const plan = planFromProductId(productId);
  if (!plan) {
    return null;
  }
  return findOfferingPackage(offering, plan);
}
