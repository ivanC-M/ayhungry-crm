const { Client } = require('@notionhq/client');

function getClient() {
  return new Client({ auth: process.env.NOTION_TOKEN });
}

async function queryAllPages(client, databaseId) {
  const pages = [];
  let cursor;
  do {
    const response = await client.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
      page_size: 100,
    });
    pages.push(...response.results);
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);
  return pages;
}

async function fetchPage(client, pageId) {
  return client.pages.retrieve({ page_id: pageId });
}

module.exports = { getClient, queryAllPages, fetchPage };
