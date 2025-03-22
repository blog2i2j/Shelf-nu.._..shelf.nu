// components/scanner/drawer.tsx
import { AssetStatus } from "@prisma/client";
import { useAtomValue, useSetAtom } from "jotai";
import { z } from "zod";
import {
  clearScannedItemsAtom,
  removeScannedItemAtom,
  scannedItemsAtom,
  removeScannedItemsByAssetIdAtom,
  removeMultipleScannedItemsAtom,
} from "~/atoms/qr-scanner";
import { AssetLabel } from "~/components/icons/library";
import type { AssetWithBooking } from "~/routes/_layout+/bookings.$bookingId.add-assets";
import type { KitForBooking } from "~/routes/_layout+/bookings.$bookingId.add-kits";
import { tw } from "~/utils/tw";
import {
  assetLabelPresets,
  createAvailabilityLabels,
  kitLabelPresets,
} from "../availability-label-factory";
import { createBlockers } from "../blockers-factory";
import ConfigurableDrawer from "../configurable-drawer";
import { GenericItemRow, DefaultLoadingState } from "../generic-item-row";

// Export the schema so it can be reused
export const addScannedAssetsToBookingSchema = z.object({
  assetIds: z.array(z.string()).min(1),
});

/**
 * Drawer component for managing scanned assets to be added to bookings
 */
export default function AssignCustodyDrawer({
  className,
  style,
  isLoading,
  defaultExpanded = false,
}: {
  className?: string;
  style?: React.CSSProperties;
  isLoading?: boolean;
  defaultExpanded?: boolean;
}) {
  // Get the scanned items from jotai
  const items = useAtomValue(scannedItemsAtom);
  const clearList = useSetAtom(clearScannedItemsAtom);
  const removeItem = useSetAtom(removeScannedItemAtom);
  const removeAssetsFromList = useSetAtom(removeScannedItemsByAssetIdAtom);
  const removeItemsFromList = useSetAtom(removeMultipleScannedItemsAtom);

  // Filter and prepare data
  const assets = Object.values(items)
    .filter((item) => !!item && item.data && item.type === "asset")
    .map((item) => item?.data as AssetWithBooking);

  const kits = Object.values(items)
    .filter((item) => !!item && item.data && item.type === "kit")
    .map((item) => item?.data as KitForBooking);

  // List of asset IDs for the form
  const assetIds = Array.from(
    new Set([
      ...assets.map((a) => a.id),
      ...kits.flatMap((k) => k.assets.map((a) => a.id)),
    ])
  );

  // Setup blockers
  const errors = Object.entries(items).filter(([, item]) => !!item?.error);

  // Asset blockers
  const assetsAlreadyInCustody = assets
    .filter((asset) => !!asset && asset.status === AssetStatus.IN_CUSTODY)
    .map((asset) => asset.id);

  // Asset is checked out
  const assetsAreCheckedOut = assets
    .filter((asset) => !!asset && asset.status === AssetStatus.CHECKED_OUT)
    .map((asset) => asset.id);

  // Asset is part of a kit
  const assetsArePartOfKit = assets
    .filter((asset) => !!asset && asset.kitId && asset.id)
    .map((asset) => asset.id);

  // Kit blockers
  // Kit is in custody
  const kitsIsAlreadyInCustody = kits
    .filter((kit) => kit.status === AssetStatus.IN_CUSTODY)
    .map((kit) => kit.id);

  // Kit has assets inside that that are in custody
  const kitsWithAssetsInCustody = kits
    .filter((kit) =>
      kit.assets.some((asset) => asset.status === AssetStatus.IN_CUSTODY)
    )
    .map((kit) => kit.id);
  // Kit is checked out
  const kitsAreCheckedOut = kits
    .filter((kit) => kit.status === AssetStatus.CHECKED_OUT)
    .map((kit) => kit.id);

  // Create blockers configuration
  const blockerConfigs = [
    {
      condition: assetsAlreadyInCustody.length > 0,
      count: assetsAlreadyInCustody.length,
      message: (count: number) => (
        <>
          <strong>{`${count} asset${count > 1 ? "s are" : " is"}`}</strong>{" "}
          already <strong>in custody</strong>.
        </>
      ),
      onResolve: () => removeAssetsFromList(assetsAlreadyInCustody),
    },
    {
      condition: assetsAreCheckedOut.length > 0,
      count: assetsAreCheckedOut.length,
      message: (count: number) => (
        <>
          <strong>{`${count} asset${count > 1 ? "s are" : "is"}`}</strong>{" "}
          checked out.
        </>
      ),
      description: "Note: Checked out assets cannot be assigned custody.",
      onResolve: () => removeAssetsFromList(assetsAreCheckedOut),
    },
    {
      condition: assetsArePartOfKit.length > 0,
      count: assetsArePartOfKit.length,
      message: (count: number) => (
        <>
          <strong>{`${count} asset${count > 1 ? "s" : ""} `}</strong> are part
          of a kit.
        </>
      ),
      description: "Note: Scan Kit QR to add the full kit",
      onResolve: () => removeAssetsFromList(assetsArePartOfKit),
    },
    {
      condition: kitsIsAlreadyInCustody.length > 0,
      count: kitsIsAlreadyInCustody.length,
      message: (count: number) => (
        <>
          <strong>{`${count} kit${count > 1 ? "s are" : " is"} `}</strong>{" "}
          already <strong>in custody</strong>.
        </>
      ),
      onResolve: () => removeItemsFromList(kitsIsAlreadyInCustody),
    },
    {
      condition: kitsWithAssetsInCustody.length > 0,
      count: kitsWithAssetsInCustody.length,
      message: (count: number) => (
        <>
          <strong>{`${count} kit${count > 1 ? "s are" : " is"} `}</strong>{" "}
          already have assets <strong>in custody</strong>.
        </>
      ),
      onResolve: () => removeItemsFromList(kitsWithAssetsInCustody),
    },
    {
      condition: kitsAreCheckedOut.length > 0,
      count: kitsAreCheckedOut.length,
      message: (count: number) => (
        <>
          <strong>{`${count} kit${count > 1 ? "s are" : " is"} `}</strong>{" "}
          checked out.
        </>
      ),
      onResolve: () => removeItemsFromList(kitsAreCheckedOut),
      description: "Note: Checked out kits cannot be assigned custody.",
    },
    {
      condition: errors.length > 0,
      count: errors.length,
      message: (count: number) => (
        <>
          <strong>{`${count} QR codes `}</strong> are invalid.
        </>
      ),
      onResolve: () => removeItemsFromList(errors.map(([qrId]) => qrId)),
    },
  ];

  // Create blockers component
  const [hasBlockers, Blockers] = createBlockers({
    blockerConfigs,
    onResolveAll: () => {
      removeAssetsFromList([
        ...assetsAlreadyInCustody,
        ...assetsAreCheckedOut,
        ...assetsArePartOfKit,
      ]);
      removeItemsFromList([
        ...errors.map(([qrId]) => qrId),
        ...kitsIsAlreadyInCustody,
        ...kitsWithAssetsInCustody,
        ...kitsAreCheckedOut,
      ]);
    },
  });

  // Custom empty state content
  const emptyStateContent = (expanded: boolean) => (
    <>
      {expanded && (
        <div className="mb-4 rounded-full bg-primary-50 p-2">
          <div className="rounded-full bg-primary-100 p-2 text-primary">
            <AssetLabel className="size-6" />
          </div>
        </div>
      )}
      <div>
        {expanded && (
          <div className="text-base font-semibold text-gray-900">
            List is empty
          </div>
        )}
        <p className="text-sm text-gray-600">Fill list by scanning codes...</p>
      </div>
    </>
  );

  // Render item row
  const renderItemRow = (qrId: string, item: any) => (
    <GenericItemRow
      key={qrId}
      qrId={qrId}
      item={item?.data}
      hasError={!!item?.error}
      error={item?.error}
      onRemove={removeItem}
      renderLoading={(qrId, error) => (
        <DefaultLoadingState qrId={qrId} error={error} />
      )}
      renderItem={(data) => {
        if (item?.type === "asset") {
          return <AssetRow asset={data as AssetWithBooking} />;
        } else if (item?.type === "kit") {
          return <KitRow kit={data as KitForBooking} />;
        }
        return null;
      }}
    />
  );

  return (
    <ConfigurableDrawer
      schema={addScannedAssetsToBookingSchema}
      formData={{ assetIds }}
      items={items}
      onClearItems={clearList}
      title="Items scanned"
      emptyStateContent={emptyStateContent}
      isLoading={isLoading}
      renderItem={renderItemRow}
      Blockers={Blockers}
      disableSubmit={hasBlockers}
      defaultExpanded={defaultExpanded}
      className={className}
      style={style}
      formName="AddScannedAssetsToBooking"
    />
  );
}

// Implement item renderers if they're not already defined elsewhere
export function AssetRow({ asset }: { asset: AssetWithBooking }) {
  // Use predefined presets to create label configurations
  const availabilityConfigs = [
    assetLabelPresets.inCustody(asset.status === AssetStatus.IN_CUSTODY),
    assetLabelPresets.checkedOut(asset.status === AssetStatus.CHECKED_OUT),
    assetLabelPresets.partOfKit(!!asset.kitId),
  ];

  // Create the availability labels component with max 2 labels
  const [, AssetAvailabilityLabels] = createAvailabilityLabels(
    availabilityConfigs,
    {
      maxLabels: 3,
      sortByPriority: true,
    }
  );
  return (
    <div className="flex flex-col gap-1">
      <p className="word-break whitespace-break-spaces font-medium">
        {asset.title}
      </p>

      <div className="flex flex-wrap items-center gap-1">
        <span
          className={tw(
            "inline-block bg-gray-50 px-[6px] py-[2px]",
            "rounded-md border border-gray-200",
            "text-xs text-gray-700"
          )}
        >
          asset
        </span>
        <AssetAvailabilityLabels />
      </div>
    </div>
  );
}

export function KitRow({ kit }: { kit: KitForBooking }) {
  // Use predefined presets to create label configurations
  const availabilityConfigs = [
    kitLabelPresets.inCustody(kit.status === AssetStatus.IN_CUSTODY),
    kitLabelPresets.checkedOut(kit.status === AssetStatus.CHECKED_OUT),
    kitLabelPresets.hasAssetsInCustody(
      kit.assets.some((asset) => asset.status === AssetStatus.IN_CUSTODY)
    ),
  ];

  // Create the availability labels component with default options
  const [, KitAvailabilityLabels] =
    createAvailabilityLabels(availabilityConfigs);

  return (
    <div className="flex flex-col gap-1">
      <p className="word-break whitespace-break-spaces font-medium">
        {kit.name}{" "}
        <span className="text-[12px] font-normal text-gray-700">
          ({kit._count.assets} assets)
        </span>
      </p>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className={tw(
            "inline-block bg-gray-50 px-[6px] py-[2px]",
            "rounded-md border border-gray-200",
            "text-xs text-gray-700"
          )}
        >
          kit
        </span>
        <KitAvailabilityLabels />
      </div>
    </div>
  );
}
