export const DEFAULT_ACTOR = 'User1';
export const DEFAULT_TO_CORP_ID = '';

export const XML_HEADER = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" noNamespaceSchemaLocation="终端接口XML Schema-3.0.xsd" SN="0300245" Version="3.0" License="01">
  <Events>
    <Event Name="SalesWareHouseOut" MainAction="WareHouseOut">
      <DataField>`;

export const XML_FOOTER = `      </DataField>
    </Event>
  </Events>
</Document>`;

export function buildDataField(
  code: string,
  actor: string,
  actDate: string,
  toCorpID: string,
  corpOrderID: string,
): string {
  return `        <Data Code="${code}" Actor="${actor}" ActDate="${actDate}" ToCorpID="${toCorpID}" CorpOrderID="${corpOrderID}" />`;
}
