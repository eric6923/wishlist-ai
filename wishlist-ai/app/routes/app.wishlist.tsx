import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node"
import { authenticate } from "../shopify.server"
import  prisma  from "../db.server"

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url)
    const action = url.searchParams.get("action")
    const customerId = url.searchParams.get("customer_id")
    const productId = url.searchParams.get("product_id")
    const shop = url.searchParams.get("shop")

    const { session } = await authenticate.public.appProxy(request)

    if (action === "check" && customerId && productId) {
      const wishlistItem = await prisma.wishlist.findFirst({
        where: {
          customerId,
          productId,
          storeId: shop || session?.shop,
        },
      })

      return json({
        success: true,
        inWishlist: !!wishlistItem,
      })
    }

    return json({ success: false, error: "Invalid request" })
  } catch (error) {
    console.error("Wishlist loader error:", error)
    return json({ success: false, error: "Auth or DB error" }, { status: 400 })
  }
}



export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.public.appProxy(request)
  const url = new URL(request.url)

  const action = url.searchParams.get("action")
  const customerId = url.searchParams.get("customer_id")
  const productId = url.searchParams.get("product_id")
  const shop = url.searchParams.get("shop") || session?.shop

  if (!customerId || !productId || !shop) {
    return json({
      success: false,
      error: "Missing required parameters",
    })
  }

  try {
    if (action === "add") {
      // Check if already exists
      const existing = await prisma.wishlist.findFirst({
        where: {
          customerId: customerId,
          productId: productId,
          storeId: shop,
        },
      })

      if (!existing) {
        await prisma.wishlist.create({
          data: {
            customerId: customerId,
            productId: productId,
            storeId: shop,
          },
        })
      }

      return json({ success: true, action: "added" })
    } else if (action === "remove") {
      await prisma.wishlist.deleteMany({
        where: {
          customerId: customerId,
          productId: productId,
          storeId: shop,
        },
      })

      return json({ success: true, action: "removed" })
    }

    return json({
      success: false,
      error: "Invalid action",
    })
  } catch (error) {
    console.error("Wishlist error:", error)
    return json({
      success: false,
      error: "Database error",
    })
  }
}
