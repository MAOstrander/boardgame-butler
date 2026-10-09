/** Trimmed copies of real BGG XML API 2 responses. */
export const SEARCH_XML = `<?xml version="1.0" encoding="utf-8"?>
<items total="4" termsofuse="https://boardgamegeek.com/xmlapi/termsofuse">
  <item type="boardgame" id="926"><name type="alternate" value="Catan: Cities &amp; Knights"/><yearpublished value="1998"/></item>
  <item type="boardgameexpansion" id="926"><name type="alternate" value="Catan: Cities &amp; Knights"/><yearpublished value="1998"/></item>
  <item type="boardgame" id="13"><name type="primary" value="CATAN"/><yearpublished value="1995"/></item>
  <item type="boardgame" id="278"><name type="primary" value="Catan Card Game"/></item>
</items>`;

export const THING_XML = `<?xml version="1.0" encoding="utf-8"?>
<items termsofuse="https://boardgamegeek.com/xmlapi/termsofuse">
  <item type="boardgame" id="13">
    <thumbnail>https://cf.geekdo-images.com/thumb.jpg</thumbnail>
    <name type="alternate" sortindex="1" value="Die Siedler von Catan"/>
    <name type="primary" sortindex="1" value="CATAN"/>
    <yearpublished value="1995"/>
    <minplayers value="3"/>
    <maxplayers value="4"/>
    <playingtime value="120"/>
    <minplaytime value="60"/>
    <maxplaytime value="120"/>
    <link type="boardgamecategory" id="1026" value="Negotiation"/>
    <statistics page="1">
      <ratings>
        <usersrated value="120000"/>
        <average value="7.1"/>
        <averageweight value="2.2885"/>
      </ratings>
    </statistics>
  </item>
</items>`;
