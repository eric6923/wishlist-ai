"use client"

import { type ActionFunctionArgs, json, type LoaderFunctionArgs } from "@remix-run/node"
import { useFetcher, useLoaderData } from "@remix-run/react"
import { useAppBridge } from "@shopify/app-bridge-react"
import { BlockStack, Button, Card, Page, Text, Banner } from "@shopify/polaris"
import prisma from "app/db.server"
import { authenticate } from "app/shopify.server"
import { MetaobjectService } from "../helpers/metaobject.server"
import { useEffect, useState } from "react"
import { ShopStatus } from "@prisma/client"

interface LoaderData {
  store: {
    shop: string
    metaObjectDefinition: any
    metaObjects: any
  } | null
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData()
  const action_type = formData.get("_action")

  if (action_type === "createWishlistMeta") {
    try {
      const { session } = await authenticate.admin(request)
      const shop = session.shop

      const metaobjectService = new MetaobjectService()

      // Check if store exists
      const existingStore = await prisma.store.findUnique({
        where: { shop },
      })

      if (!existingStore) {
        return json({ error: "Store not found" }, { status: 404 })
      }

      // Create meta object definition for wishlist if it doesn't exist
      if (!existingStore.metaObjectDefinition) {
        console.log("Creating wishlist meta object definition...")

        // Create the meta object definition for wishlist
        const metaObjectDefinition = await metaobjectService.createMetaObjectDefinition(request)
        const metaObjectDefinitionData = metaObjectDefinition.data.metaobjectDefinitionCreate.metaobjectDefinition

        console.log("Wishlist meta object definition created:", metaObjectDefinitionData)

        // Create initial meta object for wishlist
        const metaObject = await metaobjectService.createMetaObject(request)
        const metaObjectId = metaObject.id

        console.log("Wishlist meta object created:", metaObjectId)

        // Update store with definition and objects
        await prisma.store.update({
          where: { shop },
          data: {
            metaObjectDefinition: metaObjectDefinitionData,
            metaObjects: [metaObjectId],
          },
        })

        return json({
          success: true,
          message: "Wishlist meta definition and object created successfully",
        })
      } else {
        // Meta definition exists, just create a new meta object
        console.log("Meta definition exists, creating new wishlist meta object...")

        const metaObject = await metaobjectService.createMetaObject(request)
        const metaObjectId = metaObject.id

        // Add to existing meta objects array
        const currentMetaObjects = Array.isArray(existingStore.metaObjects)
          ? existingStore.metaObjects.filter(Boolean)
          : []

        await prisma.store.update({
          where: { shop },
          data: {
            metaObjects: [...currentMetaObjects, metaObjectId],
          },
        })

        return json({
          success: true,
          message: "New wishlist meta object created successfully",
        })
      }
    } catch (error: any) {
      console.error("Failed to create wishlist meta:", error)
      return json(
        {
          success: false,
          error: "Failed to create wishlist meta definition/object",
          details: error.message,
        },
        { status: 500 },
      )
    }
  }

  return json({ error: "Invalid action" }, { status: 400 })
}

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request)
  const { session } = await authenticate.admin(request)

  if (!session?.shop || !session?.accessToken) {
    throw new Response("Unauthorized", { status: 401 })
  }

  const shop = session.shop

  // Get or create store
  let storeData = await prisma.store.findUnique({
    where: { shop: session.shop },
  })

  if (storeData) {
    if (storeData.ShopStatus === ShopStatus.UNINSTALLED) {
      storeData = await prisma.store.update({
        where: { shop: session.shop },
        data: {
          accessToken: session.accessToken,
          ShopStatus: ShopStatus.INSTALLED,
        },
      })
    } else {
      storeData = await prisma.store.update({
        where: { shop: session.shop },
        data: {
          accessToken: session.accessToken,
        },
      })
    }
  } else {
    storeData = await prisma.store.create({
      data: {
        shop: session.shop,
        accessToken: session.accessToken,
        ShopStatus: ShopStatus.INSTALLED,
      },
    })
  }

  return json({
    store: storeData,
  })
}

export default function WishlistPage() {
  const { store } = useLoaderData<LoaderData>()
  const [isLoading, setIsLoading] = useState(false)
  const fetcher = useFetcher()
  const shopify = useAppBridge()

  const handleCreateWishlistMeta = () => {
    setIsLoading(true)
    fetcher.submit(
      {
        _action: "createWishlistMeta",
      },
      { method: "POST" },
    )
  }

  useEffect(() => {
    const data = fetcher.data as any
    if (data?.success) {
      setIsLoading(false)
      shopify.toast.show(data.message)
    } else if (data?.error) {
      setIsLoading(false)
      shopify.toast.show(data.error, { isError: true })
    }
  }, [fetcher.data, shopify])

  const hasMetaDefinition = store?.metaObjectDefinition !== null
  const metaObjectsCount = Array.isArray(store?.metaObjects) ? store.metaObjects.length : 0

  return (
    <Page fullWidth title="Wishlist Management">
      <BlockStack gap="500">
        {hasMetaDefinition && (
          <Banner tone="success">
            <p>Wishlist meta definition is set up! You have {metaObjectsCount} meta object(s) created.</p>
          </Banner>
        )}

        <Card>
          <BlockStack gap="400">
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Wishlist Meta Objects
              </Text>
              <Text as="p" variant="bodyMd">
                Create meta definitions and objects for your wishlist functionality.
              </Text>
            </BlockStack>

            <BlockStack gap="300">
              <Text as="p" variant="bodyMd">
                Status: {hasMetaDefinition ? "Meta definition created" : "No meta definition"}
              </Text>
              <Text as="p" variant="bodyMd">
                Meta Objects: {metaObjectsCount}
              </Text>
            </BlockStack>

            <Button onClick={handleCreateWishlistMeta} variant="primary" loading={isLoading} disabled={isLoading}>
              {hasMetaDefinition ? "Create Wishlist Meta Object" : "Create Wishlist Meta Definition & Object"}
            </Button>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  )
}
