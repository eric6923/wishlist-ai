import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node"
import { authenticate } from "../shopify.server"
import  prisma  from "../db.server"
import { GoogleGenerativeAI } from "@google/generative-ai"

// Initialize Gemini AI
const GEMINI_API_KEY = process.env.GEMINI_API_KEY
if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is not set")
}
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)

// GraphQL query for customer order history
const GET_CUSTOMER_ORDER_HISTORY = `
  query GetCustomerOrderHistory($customerId: ID!, $productId: ID!) {
    customer(id: $customerId) {
      id
      orders(first: 10, sortKey: CREATED_AT, reverse: true) {
        edges {
          node {
            id
            name
            createdAt
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            lineItems(first: 10) {
              edges {
                node {
                  title
                  quantity
                  variant {
                    id
                    product {
                      productType
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    product(id: $productId) {
      id
      title
      productType
      priceRangeV2 {
        maxVariantPrice {
          amount
          currencyCode
        }
      }
    }
  }
`

async function getStoreFromDatabase(sessionShop: string) {
  try {
    console.log("Looking for store in database:", sessionShop)

    const store = await prisma.store.findUnique({
      where: { shop: sessionShop },
    })

    if (!store) {
      console.error(`Store not found in database: ${sessionShop}`)
      throw new Error(`Store ${sessionShop} not found in database. Please ensure the app is properly installed.`)
    }

    console.log("Store found:", store.shop)
    return store
  } catch (error) {
    console.error("Error fetching store from database:", error)
    throw error
  }
}

async function predictConversionScore(customerData: any, productData: any) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    // Calculate customer metrics
    const orders = customerData.orders.edges
    const totalOrders = orders.length
    const totalSpent = orders.reduce((sum: number, order: any) => {
      return sum + Number.parseFloat(order.node.totalPriceSet.shopMoney.amount)
    }, 0)

    // Get product categories from order history
    const purchasedCategories = new Set()
    orders.forEach((order: any) => {
      order.node.lineItems.edges.forEach((item: any) => {
        if (item.node.variant?.product?.productType) {
          purchasedCategories.add(item.node.variant.product.productType)
        }
      })
    })

    // Calculate average order value
    const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0

    // Check if customer has bought similar products
    const hasBoughtSimilar = purchasedCategories.has(productData.productType)

    const prompt = `
      Analyze this customer's purchase behavior and predict their likelihood to buy the wishlisted product.
      
      Customer Profile:
      - Total Orders: ${totalOrders}
      - Total Spent: ${totalSpent} ${orders[0]?.node?.totalPriceSet?.shopMoney?.currencyCode || "INR"}
      - Average Order Value: ${avgOrderValue.toFixed(2)}
      - Has bought similar products (${productData.productType}): ${hasBoughtSimilar ? "Yes" : "No"}
      - Previously purchased categories: ${Array.from(purchasedCategories).join(", ") || "None"}
      
      Wishlisted Product:
      - Product: ${productData.title}
      - Category: ${productData.productType}
      - Price: ${productData.priceRangeV2.maxVariantPrice.amount} ${productData.priceRangeV2.maxVariantPrice.currencyCode}
      
      Based on this data, predict the percentage chance (0-100) that this customer will purchase the wishlisted product within the next 30 days.
      
      Consider factors like:
      - Purchase frequency and recency
      - Spending patterns
      - Product category affinity
      - Price point vs average order value
      
      Respond with only a number between 0-100.
    `

    const result = await model.generateContent(prompt)
    const response = await result.response
    const scoreText = response.text().trim()

    // Extract number from response
    const score = Number.parseInt(scoreText.match(/\d+/)?.[0] || "0")
    return Math.min(Math.max(score, 0), 100) // Ensure score is between 0-100
  } catch (error) {
    console.error("Error generating conversion score:", error)
    return 50 // Default score if AI fails
  }
}

async function getCustomerOrderHistoryWithAccessToken(
  customerId: string,
  productId: string,
  shop: string,
  accessToken: string,
) {
  try {
    console.log("Querying Shopify GraphQL with access token...")

    const shopifyGraphQLUrl = `https://${shop}/admin/api/2024-01/graphql.json`

    const response = await fetch(shopifyGraphQLUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({
        query: GET_CUSTOMER_ORDER_HISTORY,
        variables: {
          customerId: `gid://shopify/Customer/${customerId}`,
          productId: `gid://shopify/Product/${productId}`,
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    if (data.errors) {
      console.error("GraphQL errors:", data.errors)
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`)
    }

    console.log("Customer order history data received:", {
      hasCustomer: !!data.data?.customer,
      hasProduct: !!data.data?.product,
      ordersCount: data.data?.customer?.orders?.edges?.length || 0,
    })

    return data.data
  } catch (error) {
    console.error("Error fetching customer order history with access token:", error)
    return null
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const { session } = await authenticate.public.appProxy(request)
    const url = new URL(request.url)

    const action = url.searchParams.get("action")
    const customerId = url.searchParams.get("customer_id")
    const productId = url.searchParams.get("product_id")

    console.log(
      "Loader - Action:",
      action,
      "Customer:",
      customerId,
      "Product:",
      productId,
      "Session Shop:",
      session.shop,
    )

    // Get store from database
    const store = await getStoreFromDatabase(session.shop)

    if (action === "check" && customerId && productId) {
      const wishlistItem = await prisma.wishlist.findFirst({
        where: {
          customerId: customerId,
          productId: productId,
          storeId: store.shop,
        },
        include: {
          conversions: true,
        },
      })

      return json({
        success: true,
        inWishlist: !!wishlistItem,
        conversionScore: wishlistItem?.conversions?.[0]?.convertion_value || null,
      })
    }

    return json({ success: false, error: "Invalid request" })
  } catch (error) {
    console.error("Loader error:", error)
    return json({
      success: false,
      error: `Loader error: ${error.message}`,
    })
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const { session } = await authenticate.public.appProxy(request)
    const url = new URL(request.url)

    const action = url.searchParams.get("action")
    const customerId = url.searchParams.get("customer_id")
    const productId = url.searchParams.get("product_id")

    console.log(
      "Action - Action:",
      action,
      "Customer:",
      customerId,
      "Product:",
      productId,
      "Session Shop:",
      session.shop,
    )

    if (!customerId || !productId) {
      return json({
        success: false,
        error: "Missing required parameters: customerId and productId",
      })
    }

    // Get store from database
    const store = await getStoreFromDatabase(session.shop)
    console.log("Using store from database:", store.shop)

    if (action === "add") {
      // Check if already exists
      let wishlistItem = await prisma.wishlist.findFirst({
        where: {
          customerId: customerId,
          productId: productId,
          storeId: store.shop,
        },
        include: {
          conversions: true,
        },
      })

      if (!wishlistItem) {
        console.log("Creating new wishlist item...")
        // Create new wishlist item
        wishlistItem = await prisma.wishlist.create({
          data: {
            customerId: customerId,
            productId: productId,
            storeId: store.shop,
          },
          include: {
            conversions: true,
          },
        })
        console.log("Wishlist item created successfully:", wishlistItem.id)
      }

      // Generate conversion score if not exists
      if (wishlistItem.conversions.length === 0) {
        try {
          console.log("Fetching customer order history and generating conversion score...")

          // Get customer data using access token directly
          const orderHistoryData = await getCustomerOrderHistoryWithAccessToken(
            customerId,
            productId,
            store.shop,
            store.accessToken,
          )

          if (orderHistoryData?.customer && orderHistoryData?.product) {
            console.log("Customer data received:", {
              email: orderHistoryData.customer.email,
              ordersCount: orderHistoryData.customer.orders.edges.length,
              productTitle: orderHistoryData.product.title,
            })

            // Generate conversion score using Gemini
            const conversionScore = await predictConversionScore(orderHistoryData.customer, orderHistoryData.product)

            console.log("Generated conversion score:", conversionScore)

            // Extract order IDs and order history for storage
            const orders = orderHistoryData.customer.orders.edges
            const orderIds = orders.map((edge: any) => edge.node.id)
            const orderHistory = orders.map(
              (edge: any) =>
                `${edge.node.name} - ${edge.node.totalPriceSet.shopMoney.amount} ${edge.node.totalPriceSet.shopMoney.currencyCode} (${edge.node.createdAt})`,
            )

            console.log("Order data to store:", {
              orderIds: orderIds.length,
              orderHistory: orderHistory.length,
            })

            // Create conversion record with both orderId and orderHistory
            const conversion = await prisma.conversion.create({
              data: {
                wishlistId: wishlistItem.id,
                orderId: orderIds, // Array of order IDs
                orderHistory: orderHistory, // Array of order summaries
                convertion_value: conversionScore,
              },
            })

            console.log("Conversion record created successfully:", conversion.id)

            return json({
              success: true,
              action: "added",
              conversionScore: conversionScore,
              message: "Added to wishlist with AI conversion score!",
            })
          } else {
            console.log("Could not fetch order history data, but wishlist item created")
            return json({
              success: true,
              action: "added",
              conversionScore: null,
              message: "Added to wishlist, but could not generate conversion score",
            })
          }
        } catch (conversionError) {
          console.error("Error generating conversion score:", conversionError)
          // Still return success since wishlist item was created
          return json({
            success: true,
            action: "added",
            conversionScore: null,
            message: "Added to wishlist, but conversion scoring failed",
          })
        }
      } else {
        // Wishlist item already exists with conversion score
        return json({
          success: true,
          action: "added",
          conversionScore: wishlistItem.conversions[0].convertion_value,
          message: "Already in wishlist",
        })
      }
    } else if (action === "remove") {
      // Also remove associated conversion records
      const wishlistItems = await prisma.wishlist.findMany({
        where: {
          customerId: customerId,
          productId: productId,
          storeId: store.shop,
        },
        include: {
          conversions: true,
        },
      })

      // Delete conversion records first
      for (const item of wishlistItems) {
        if (item.conversions.length > 0) {
          await prisma.conversion.deleteMany({
            where: {
              wishlistId: item.id,
            },
          })
        }
      }

      // Then delete wishlist items
      const deletedCount = await prisma.wishlist.deleteMany({
        where: {
          customerId: customerId,
          productId: productId,
          storeId: store.shop,
        },
      })

      console.log("Deleted wishlist items:", deletedCount.count)

      return json({
        success: true,
        action: "removed",
        message: "Removed from wishlist",
      })
    }

    return json({
      success: false,
      error: "Invalid action",
    })
  } catch (error) {
    console.error("Action error:", error)
    return json({
      success: false,
      error: `Action error: ${error.message}`,
    })
  }
}
