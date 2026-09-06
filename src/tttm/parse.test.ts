import { describe, expect, it } from 'vitest'
import {
  nameFromUrl,
  parsePlayerCard,
  parseRankingRows,
  playerPageUrl,
  rankMatches,
  searchPageUrl,
  searchTerms,
  tttmIdFrom,
  type TttmPlayer,
} from './parse'

/**
 * Captured from tttm.co.il, byte for byte.
 *
 * Fixtures rather than a hand-written approximation, because every sharp edge in this
 * parser is something the real markup does and a tidy sample would not: a malformed
 * `<td 0>` attribute, the site's own silhouette standing in for a missing photograph,
 * the words for "unattached" sitting where a club name goes, and points printed as
 * "1747.6 (0.0)".
 */
const RELAYED_ROWS = `<tr>
        <td><span class="nw">=&gt;</span></td>
        <td class="rk">            4        </td>
        <td>676</td>
        <td 0=""> S</td>
        <td><img class="playerPict playerPictTrans" src="/playerPict/676/goren.jpg"> </td>
        <td class="player"><a href="/p/676/עמית-גורן">עמית גורן</a></td>
        <td class="club">עירוני גבעתיים</td> 
        <td>1747.6 (0.0)</td>
    </tr>
<tr>
        <td><span class="nw">=&gt;</span></td>
        <td class="rk">                    </td>
        <td>2682</td>
        <td 0=""> S</td>
        <td><img class="playerPict" src="/img/AvatarM.png"> </td>
        <td class="player"><a href="/p/2682/עמית-גורן">עמית גורן</a></td>
        <td class="club">ללא מועדון</td> 
        <td>0.0 (0.0)</td>
    </tr>
<tr>
        <td><span class="nw">=&gt;</span></td>
        <td class="rk">                    </td>
        <td>7675</td>
        <td 0=""> E20</td>
        <td><img class="playerPict" src="/img/AvatarM.png"> </td>
        <td class="player"><a href="/p/7675/הראל-גורן">הראל גורן</a></td>
        <td class="club">ללא מועדון</td> 
        <td>0.0 (0.0)</td>
    </tr>
<tr>
        <td><span class="nw">=&gt;</span></td>
        <td class="rk">            429        </td>
        <td>2643</td>
        <td 0=""> S50</td>
        <td><img class="playerPict playerPictTrans" src="/playerPict/2643/2643.jpg"> </td>
        <td class="player"><a href="/p/2643/שמעון-גורן">שמעון גורן</a></td>
        <td class="club">הפועל יוקנעם</td> 
        <td>628.2 (0.0)</td>
    </tr>`

/** The same row straight from the site: self-closing tags, single-quoted attributes. */
const RAW_ROW = `<tr class="">
        <td><span class='nw'>=></span></td>
        <td class="rk">            4        </td>
        <td>676</td>
        <td 0> S</td>
        <td><img class="playerPict playerPictTrans" src="/playerPict/676/goren.jpg" /> </td>
        <td class="player"><a href="/p/676/עמית-גורן">עמית גורן</a></td>
        <td class="club">עירוני גבעתיים</td> 
        <td>1747.6 (0.0)</td>
    </tr>`

/** A player card — the fragment the relay returns for .playerPresentation. */
const CARD = `<div class="playerPresentation">
            <img id="playerPict" class="playerPict" src="/playerPict/676/goren.jpg">
            <div class="playerName">
                עמית גורן            </div>
            
            <div>
                <a href="/c/26/עירוני-גבעתיים">
                   עירוני גבעתיים                </a>
           
           </div>
           <div>ID של השחקן : <b>676</b></div>     
           <div><span>קטגוריה : <b>S</b></span> 
                <span>נקודות : <b>1747.6</b></span>
           </div> 
           <table>
                <tbody><tr>                    <td>גברים</td>
                    <td></td> 
                </tr>
                <tr>                    <td><b>4</b></td>
                    <td><b></b></td> 
                </tr>
           </tbody></table>    
                           <div class="notActive">לא פעיל</div>
            
    </div>`

const byId = (players: readonly TttmPlayer[], id: number) =>
  players.find((player) => player.tttmId === id)

describe('parseRankingRows', () => {
  it('reads a ranked player out of the table', () => {
    expect(byId(parseRankingRows(RELAYED_ROWS), 676)).toEqual({
      tttmId: 676,
      name: 'עמית גורן',
      rank: 1747.6,
      club: 'עירוני גבעתיים',
      category: 'S',
      position: 4,
      photo: 'https://www.tttm.co.il/playerPict/676/goren.jpg',
    })
  })

  it('reads the same player out of the markup the site serves directly', () => {
    expect(parseRankingRows(RAW_ROW)).toEqual([byId(parseRankingRows(RELAYED_ROWS), 676)])
  })

  it('keeps a registered player who has not scored yet', () => {
    // 0.0 is a real rank and has to survive. It is what a new league entrant carries,
    // and discarding it would send the manager off to type a number already correct.
    const harel = byId(parseRankingRows(RELAYED_ROWS), 7675)
    expect(harel?.name).toBe('הראל גורן')
    expect(harel?.rank).toBe(0)
  })

  it('leaves the club out rather than printing "unattached" as one', () => {
    expect(byId(parseRankingRows(RELAYED_ROWS), 7675)?.club).toBeUndefined()
  })

  it('takes no photograph when the site is showing its own silhouette', () => {
    expect(byId(parseRankingRows(RELAYED_ROWS), 7675)?.photo).toBeUndefined()
  })

  it('reads a player ranked far down the list', () => {
    expect(byId(parseRankingRows(RELAYED_ROWS), 2643)?.position).toBe(429)
  })

  it('ignores the header row', () => {
    expect(parseRankingRows('<tr><th>שם</th><th>נקודות</th></tr>')).toEqual([])
  })

  it('returns nothing for a search that found nobody', () => {
    expect(parseRankingRows('<table class="rank"></table>')).toEqual([])
  })
})

describe('parsePlayerCard', () => {
  it('reads the card', () => {
    expect(parsePlayerCard(CARD)).toEqual({
      tttmId: 676,
      name: 'עמית גורן',
      rank: 1747.6,
      club: 'עירוני גבעתיים',
      category: 'S',
      photo: 'https://www.tttm.co.il/playerPict/676/goren.jpg',
    })
  })

  it('is null for anything that is not a card', () => {
    expect(parsePlayerCard('')).toBeNull()
    expect(parsePlayerCard('<div>404</div>')).toBeNull()
    // An id with no points on the page is not a player this can use.
    expect(parsePlayerCard('<div>ID של השחקן : <b>676</b></div>')).toBeNull()
  })
})

describe('searchTerms', () => {
  /**
   * The behaviour the whole search path is built around: TTTM matches one word
   * against one name field, so a full name finds nobody while the surname finds the
   * whole family. Sending the full string would spend a request to learn nothing.
   */
  it('sends the surname first and never the whole name', () => {
    expect(searchTerms('עמית גורן')).toEqual(['גורן', 'עמית'])
  })

  it('sends a single name as it is', () => {
    expect(searchTerms('  גורן ')).toEqual(['גורן'])
  })

  it('has nothing to try for an empty name', () => {
    expect(searchTerms('   ')).toEqual([])
  })

  it('does not repeat a word', () => {
    expect(searchTerms('גורן גורן')).toEqual(['גורן'])
  })
})

describe('reading a pasted link', () => {
  it('takes the id out of the link the site hands out', () => {
    expect(tttmIdFrom('https://www.tttm.co.il/p/676/עמית-גורן')).toBe(676)
  })

  it('copes with the suffixed form', () => {
    expect(tttmIdFrom('https://www.tttm.co.il/p/676-a-1/%D7%A2%D7%9E%D7%99%D7%AA')).toBe(676)
  })

  it('accepts the number on its own', () => {
    expect(tttmIdFrom(' 676 ')).toBe(676)
  })

  it('refuses anything else', () => {
    expect(tttmIdFrom('https://www.tttm.co.il/c/26/club')).toBeNull()
    expect(tttmIdFrom('עמית גורן')).toBeNull()
    expect(tttmIdFrom('')).toBeNull()
  })

  it('recovers the name from the slug', () => {
    const encoded = 'https://www.tttm.co.il/p/676/%D7%A2%D7%9E%D7%99%D7%AA-%D7%92%D7%95%D7%A8%D7%9F'
    expect(nameFromUrl(encoded)).toBe('עמית גורן')
    expect(nameFromUrl('https://www.tttm.co.il/p/676-a-1/עמית-גורן')).toBe('עמית גורן')
  })

  it('has no name to recover from a placeholder slug', () => {
    expect(nameFromUrl(playerPageUrl(676))).toBeUndefined()
    expect(nameFromUrl('676')).toBeUndefined()
  })

  it('builds a readable link back', () => {
    expect(playerPageUrl(676, 'עמית גורן')).toBe(
      `https://www.tttm.co.il/p/676/${encodeURIComponent('עמית-גורן')}`,
    )
  })

  it('builds a search the site answers', () => {
    expect(searchPageUrl('גורן')).toBe(
      `https://www.tttm.co.il/?page=rank&search=${encodeURIComponent('גורן')}`,
    )
  })
})

describe('rankMatches', () => {
  const family = parseRankingRows(RELAYED_ROWS)

  it('puts an exact name first, whatever order the site returned', () => {
    expect(rankMatches(family, 'עמית גורן')[0].tttmId).toBe(676)
  })

  /**
   * The case that made points part of the ordering. Two players are called עמית גורן
   * — 676 on 1747.6 with a club, 2682 on 0.0 with none — and TTTM lists 2682 first,
   * so matching on the name alone offers the wrong man at the top of the list.
   */
  it('prefers the one who has actually played, among names that match equally', () => {
    const exact = rankMatches(family, 'עמית גורן').filter((p) => p.name === 'עמית גורן')
    expect(exact.map((p) => p.tttmId)).toEqual([676, 2682])
  })

  it('never drops the others — the spelling here may be the wrong one', () => {
    expect(rankMatches(family, 'עמית גורן')).toHaveLength(family.length)
  })

  it('falls back to points when no name matches at all', () => {
    const order = rankMatches(family, 'מישהו אחר')
    expect(order.map((player) => player.rank)).toEqual(
      [...family.map((player) => player.rank)].sort((a, b) => b - a),
    )
  })
})
