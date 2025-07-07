import {
  Card,
  InlineStack,
  Text,
  Box,
  BlockStack,
  Button,
  Banner,
  SkeletonBodyText,
  SkeletonDisplayText,
  SkeletonThumbnail,
  Icon,
  Popover,
  ActionList,
  Link,
  Listbox,
  Combobox,
} from '@shopify/polaris';
import { ArrowRightIcon, CalendarIcon, SearchIcon } from "@shopify/polaris-icons"
import { type ActionFunctionArgs, json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "app/db.server";
import { MetaobjectService } from "../helpers/metaobject.server";

import { useLoaderData, useNavigate } from "@remix-run/react"
import { useCallback, useEffect, useMemo, useState } from "react"

// Shopify API imports for server-side logic
import { ApiVersion, GraphqlClient, Session } from "@shopify/shopify-api";

import pkg from "@prisma/client";
const { ShopStatus } = pkg;

// Define the loader return type
type LoaderData = {
  isAppEmbedEnabled: boolean;
  shopDomain: string;
  shopThemeId: string | null;
  appExtensionGlobalId: string | null;
  affiliatePortalBlockId: string | null;
  extensionId: string;
};


export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  console.log("Session from auth index:", session);

  if (!session?.shop || !session?.accessToken) {
    throw new Response("Unauthorized", { status: 401 });
  }

  // Step 1: Handle Store creation/updating
  let storeData;
  const existingStore = await prisma.store.findUnique({ where: { shop: session.shop } });

  if (existingStore) {
    if (ShopStatus.UNINSTALLED) {
      storeData = await prisma.store.update({
        where: { shop: session.shop },
        data: {
          accessToken: session.accessToken,
        },
      });
    } else {
      storeData = await prisma.store.update({
        where: { shop: session.shop },
        data: {
          accessToken: session.accessToken,
        },
      });
    }
  } else {
    storeData = await prisma.store.create({
      data: {
        shop: session.shop,
        accessToken: session.accessToken,
        ShopStatus: ShopStatus.INSTALLED, // or another valid enum value
      },
    });
  }

  console.log("Final store data:", storeData);


  return json({
    storeData: {
      shop: storeData.shop,
    },
    extensionId: process.env.SHOPIFY_POPUP_EXTENSION_ID,
  });
};

export default function Index() {
  const {

  } = useLoaderData<typeof loader>();


  const navigate = useNavigate();

  // --- State from Function 1 ---
  const [isLoading, setIsLoading] = useState(true);
  const [popoverActive, setPopoverActive] = useState(false);
  const [popupPopoverActive, setPopupPopoverActive] = useState(false);
  const [selectedPopups, setSelectedPopups] = useState<string[]>([]);
  const popupOptions = [
    { label: "Opt-in popup", value: "optin" },
    { label: "Spin wheel popup", value: "spinwheel" },
    { label: "Opt-in popup", value: "optin2" }, // Duplicate value 'optin' - consider if this is intentional
  ];
  const [selectedRange, setSelectedRange] = useState("last_30_days"); // State initialized but not used in UI yet
  // const [selectedPopup, setSelectedPopup] = useState('popup'); // This state variable was only used for the label in the first function, now replaced by Combobox

  // Mock data for the chart (from Function 1)
  const chartData = [
    { date: "Apr 14", views: 0, subscribers: 0 },
    { date: "Apr 16", views: 0, subscribers: 0 },
    { date: "Apr 18", views: 0, subscribers: 0 },
    { date: "Apr 20", views: 0, subscribers: 0 },
    { date: "Apr 22", views: 0, subscribers: 0 },
    { date: "Apr 24", views: 0, subscribers: 0 },
    { date: "Apr 26", views: 0, subscribers: 0 },
    { date: "Apr 28", views: 0, subscribers: 0 },
    { date: "Apr 30", views: 0, subscribers: 0 },
    { date: "May 2", views: 0, subscribers: 0 },
    { date: "May 4", views: 0, subscribers: 0 },
    { date: "May 6", views: 0, subscribers: 0 },
    { date: "May 8", views: 8, subscribers: 2 },
    { date: "May 10", views: 0, subscribers: 0 },
    { date: "May 12", views: 0, subscribers: 0 },
  ];

  // const rangeOptions = [ // Not used in UI, but kept for context if needed for future dropdown
  //   { label: 'Last 30 days', value: 'last_30_days' },
  // ];

  // --- State from Function 2 ---
  // Note: popupLists and filteredSubscribers are states that manage data derived from loader data
}