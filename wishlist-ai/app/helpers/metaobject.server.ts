import { authenticate } from "app/shopify.server";
import { ApiVersion, GraphqlClient, Session } from "@shopify/shopify-api";

// Add these type definitions
interface ThemeNode {
  id: string;
  role: string;
  files: {
    nodes: Array<{
      filename: string;
      body?: {
        content?: string;
        contentBase64?: string;
        url?: string;
      };
    }>;
  };
}

interface ThemeListResponse {
  data: {
    themes: {
      edges: Array<{
        node: ThemeNode;
      }>;
    };
  };
}

// GraphQL query to fetch theme files
const THEME_LIST_QUERY = `query ThemeList($roles: [ThemeRole!], $filenames: [String!]!) {
  themes(first: 10, roles: $roles) {
    edges {
      node {
        id
        role
        files(filenames: $filenames) {
          nodes {
            body {
              ... on OnlineStoreThemeFileBodyBase64 { contentBase64 }
              ... on OnlineStoreThemeFileBodyText { content }
              ... on OnlineStoreThemeFileBodyUrl { url }
            }
            filename
          }
        }
      }
      cursor
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
    }
  }
}`;

export class MetaobjectService {

  async getThemeSettingsData(request: any) {
    const { admin } = await authenticate.admin(request);

    try {
      const response = await admin.graphql(THEME_LIST_QUERY, {
        variables: {
          roles: ['MAIN'],
          filenames: ['config/settings_data.json'],
        },
      });

      const themeData = await response.json();
      console.log("themeData: ", themeData);

      const mainTheme = themeData?.data?.themes?.edges.find(
        (edge: { node: ThemeNode }) => edge?.node?.role === 'MAIN'
      )?.node;

      if (mainTheme) {
        const settingsFile = mainTheme.files.nodes.find(
          (file: { filename: string }) => file.filename === 'config/settings_data.json'
        );

        if (settingsFile && settingsFile.body) {
          let fileContent: string | null = null;
          if (settingsFile.body.content) {
            fileContent = settingsFile.body.content;
          } else if (settingsFile.body.contentBase64) {
            if (typeof Buffer !== 'undefined') {
              fileContent = Buffer.from(settingsFile.body.contentBase64, 'base64').toString('utf8');
            } else {
              console.warn("Buffer is not available to decode contentBase64. This should not happen in a Remix loader.");
            }
          }

          return {
            shopThemeId: mainTheme.id.split('/').pop() || null,
            settingsContent: fileContent,
          };
        }
      }
      return null;
    } catch (error) {
      console.error("Error fetching theme settings data:", error);
      throw error;
    }
  }

  async createMetaObjectDefinition(request: any, popupData: any) {
    const { admin } = await authenticate.admin(request);

    console.log("Entered into saveMetaobject ----> createMetaDefinition");

    const response = await admin.graphql(
      `#graphql
      mutation CreateMetaobjectDefinition($definition: MetaobjectDefinitionCreateInput!) {
        metaobjectDefinitionCreate(definition: $definition) {
          metaobjectDefinition {
            id
            name
            type
            fieldDefinitions {
              name
              key
            }
          }
          userErrors {
            field
            message
            code
          }
        }
      }`,
      {
        variables: {
          definition: {
            name: "Test 3 Spin wheel popup App Owned New TEst",
            type: `app--${process.env.APP_ID}--spin-wheel-840`,
            fieldDefinitions: [
              {
                name: "popup settings",
                key: "settings",
                type: "json",
              },
            ],
          },
        },
      }
    );


    const data = await response.json();

    if (data?.data?.metaobjectDefinitionCreate?.userErrors?.length) {
      console.error("User Errors from createMetaDefinition:", data.data.metaobjectDefinitionCreate.userErrors);
    }

    console.log("Metaobject Definition saved:", data);
    const defintion = data.data.metaobjectDefinitionCreate.metaobjectDefinition;
    console.log("Metaobject Definition Object ------> :", defintion);
    return data;
  }

  async createMetaObject(request: any, popupData: any) {
    const { admin } = await authenticate.admin(request);

    console.log("Entered into createMetaobject");

    const response = await admin.graphql(
      `#graphql
    mutation CreateMetaobject($metaobject: MetaobjectCreateInput!) {
      metaobjectCreate(metaobject: $metaobject) {
        metaobject {
          id
          type
          handle
          season: field(key: "settings") {
            value
          }
        }
        userErrors {
          field
          message
          code
        }
      }
    }`,
      {
        variables: {
          "metaobject": {
            "type": `app--${process.env.APP_ID}--spin-wheel-840`,
            "handle": "spin-wheel-popup-new-app-owned",
            "fields": [
              {
                "key": "settings",
                "value": JSON.stringify(popupData)
              }
            ]
          }
        },
      },
    );

    const data = await response.json();

    if (data?.data?.metaobjectCreate?.userErrors?.length) {
      console.error("User Errors from createMetaObject:", data.data.metaobjectCreate.userErrors);
    }

    console.log("Metaobject saved:", data.data.metaobjectCreate.metaobject);

    return data.data.metaobjectCreate.metaobject

  }

  async getMetaObject(request: any, id: string) {
    const { admin } = await authenticate.admin(request);

    const response = await admin.graphql(
      `#graphql
      query GetMetaobjectById($id: ID!) {
        metaobject(id: $id) {
          id
          handle
          type
          fields {
            key
            value
          }
        }
      }`,
      {
        variables: {
          id: id,
        },
      },
    );

    const data = await response.json();

    if (data?.data?.metaobject?.userErrors?.length) {
      console.error("User Errors from getMetaObject:", data.data.metaobject.userErrors);
    }

    console.log("Metaobject saved:", data.data.metaobject);
    return data.data.metaobject;
  }

  async updateMetaObject(request: any, metaobjectId: any, key: any, popupData: any) {
    const { admin } = await authenticate.admin(request);

    const response = await admin.graphql(
      `#graphql
  mutation UpdateMetaobject($id: ID!, $metaobject: MetaobjectUpdateInput!) {
    metaobjectUpdate(id: $id, metaobject: $metaobject) {
      metaobject {
        handle
        type
        field(key: "${key}") {
          value
        }
      }
      userErrors {
        field
        message
        code
      }
    }
  }`,
      {
        variables: {
          "id": metaobjectId,
          "metaobject": {
            "fields": [
              {
                "key": key,
                "value": typeof popupData === "string" ? popupData : JSON.stringify(popupData)
              }
            ]
          }
        },
      },
    );

    const data = await response.json();

    if (data?.data?.metaobjectUpdate?.userErrors?.length) {
      console.error("User Errors from updateMetaObject:", data.data.metaobjectUpdate.userErrors);
    }

    console.log("Metaobject saved:", data.data.metaobjectUpdate.metaobject);
    return data.data.metaobjectUpdate.metaobject

  }

  async deleteMetaObject(request: any, metaobjectId: string) {
    const { admin } = await authenticate.admin(request);
    const response = await admin.graphql(
      `#graphql
      mutation DeleteMetaobject($id: ID!) {
        metaobjectDelete(id: $id) {
          deletedId
          userErrors {
            field
            message
            code
          }
        }
      }`,
      {
        variables: {
          id: metaobjectId,
        },
      },
    );
    const data = await response.json();
    if (data?.data?.metaobjectDelete?.userErrors?.length) {
      console.error("User Errors from deleteMetaObject:", data.data.metaobjectDelete.userErrors);
    }
    return data.data.metaobjectDelete;
  }


}
