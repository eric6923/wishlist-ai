export const GetCustomerOrderHistory =
`
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