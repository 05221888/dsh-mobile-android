import { readFile } from 'node:fs/promises'

export const name = 'dsh-leisure-zone'
export const inject = ['fs', 'webServer']

export function apply(ctx) {
  const bookFile = process.env.DSH_LEISURE_BOOK_CKJ || (process.env.HOME + '/leisure-books/ckj.json')
  const math2File = process.env.DSH_LEISURE_BOOK_MATH2 || (process.env.HOME + '/leisure-books/math2-calculus.json')
  const books = [
    { id: 'ckj', name: '材科基-知识点精讲', file: bookFile, total: 153 },
    { id: 'math2-calculus', name: '考研数学二·高等数学公式教材', file: math2File, total: 75 },
  ]
  const cache = new Map()
  const mastered = new Map()
  const shortplays = [
    {
      id: 'fixture-landing', title: '降落于你心上', genre: '都市 · 甜宠', episodeCount: 24,
      cover: 'https://p26-tt.byteimg.com/obj/xs_fm_mobile_res/dsl_ug/video_detail_poster/v725_hongguo_logo_lockup_20260601.png',
      intro: '飞行员 × 空管员，三万英尺的暗恋终于落地。',
      status: '完结', episodes: Array.from({ length: 24 }, (_, i) => ({ id: `fixture-landing-${i + 1}`, number: i + 1, title: `第${i + 1}集` })),
    },
    {
      id: 'fixture-echoes', title: '回声里的夏天', genre: '都市 · 情感', episodeCount: 12,
      cover: 'https://p26-tt.byteimg.com/obj/xs_fm_mobile_res/dsl_ug/video_detail_poster/v725_hongguo_logo_lockup_20260601.png',
      intro: '一段旧录音，牵出一场迟到了多年的重逢。',
      status: '完结', episodes: Array.from({ length: 12 }, (_, i) => ({ id: `fixture-echoes-${i + 1}`, number: i + 1, title: `第${i + 1}集` })),
    },
    {
      id: 'fixture-night-train', title: '夜行列车', genre: '悬疑 · 都市', episodeCount: 8,
      cover: 'https://p26-tt.byteimg.com/obj/xs_fm_mobile_res/dsl_ug/video_detail_poster/v725_wheat_left_20260521.png',
      intro: '每一站都有人下车，只有她知道终点并不存在。',
      status: '完结', episodes: Array.from({ length: 8 }, (_, i) => ({ id: `fixture-night-train-${i + 1}`, number: i + 1, title: `第${i + 1}集` })),
    },
    {
      id: 'fixture-judge', title: '青天在上', genre: '古装 · 悬疑', episodeCount: 16,
      cover: 'https://p26-tt.byteimg.com/obj/xs_fm_mobile_res/dsl_ug/video_detail_poster/v725_wheat_left_20260521.png',
      intro: '女扮男装进大理寺，第一案就查到了自己头上。',
      status: '连载', episodes: Array.from({ length: 16 }, (_, i) => ({ id: `fixture-judge-${i + 1}`, number: i + 1, title: `第${i + 1}集` })),
    },
    {
      id: 'fixture-ex', title: '前夫请自重', genre: '古代 · 虐恋', episodeCount: 20,
      cover: 'https://p26-tt.byteimg.com/obj/xs_fm_mobile_res/dsl_ug/video_detail_poster/v725_wheat_left_20260521.png',
      intro: '重生后她只想拿到和离书，没想到王爷不干了。',
      status: '完结', episodes: Array.from({ length: 20 }, (_, i) => ({ id: `fixture-ex-${i + 1}`, number: i + 1, title: `第${i + 1}集` })),
    },
    {
      id: 'fixture-boss', title: '总裁他是个憨憨', genre: '喜剧 · 甜宠', episodeCount: 15,
      cover: 'https://p26-tt.byteimg.com/obj/xs_fm_mobile_res/dsl_ug/video_detail_poster/v725_hongguo_logo_lockup_20260601.png',
      intro: '霸总失忆后以为自己是只猫，全公司都疯了。',
      status: '连载', episodes: Array.from({ length: 15 }, (_, i) => ({ id: `fixture-boss-${i + 1}`, number: i + 1, title: `第${i + 1}集` })),
    },
    {
      id: 'fixture-ghost', title: '我在规则怪谈当公务员', genre: '悬疑 · 灵异', episodeCount: 10,
      cover: 'https://p26-tt.byteimg.com/obj/xs_fm_mobile_res/dsl_ug/video_detail_poster/v725_wheat_left_20260521.png',
      intro: '死后进了地府事业编，每天处理奇葩投诉。',
      status: '连载', episodes: Array.from({ length: 10 }, (_, i) => ({ id: `fixture-ghost-${i + 1}`, number: i + 1, title: `第${i + 1}集` })),
    },
    {
      id: 'fixture-short', title: '不想当顶流', genre: '娱乐圈 · 喜剧', episodeCount: 6,
      cover: 'https://p26-tt.byteimg.com/obj/xs_fm_mobile_res/dsl_ug/video_detail_poster/v725_hongguo_logo_lockup_20260601.png',
      intro: '一个只想退圈的演员，却在全网爆红了。',
      status: '番外', episodes: Array.from({ length: 6 }, (_, i) => ({ id: `fixture-short-${i + 1}`, number: i + 1, title: `第${i + 1}集` })),
    },
  ]

  async function loadBook(id) {
    if (cache.has(id)) return cache.get(id)
    const book = books.find((item) => item.id === id)
    if (book === undefined) return null
    try {
      const target = await ctx.fs.resolve(book.file)
      const data = JSON.parse(await ctx.fs.readText(target))
      cache.set(id, data)
      return data
    } catch (error) {
      ctx.logger.error('leisure-zone: textbook load failed: %s', error instanceof Error ? error.message : String(error))
      return null
    }
  }

  function send(res, body, status = 200) {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-cache' })
    res.end(JSON.stringify(body))
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/leisure-zone/api',
    handler: async (req, res) => {
      const url = new URL(req.url || '/', 'http://localhost')
      const textbookId = url.searchParams.get('textbookId') || 'ckj'
      if (url.pathname === '/leisure-zone/api/shortplay/search') {
        const query = (url.searchParams.get('q') || '').trim().toLocaleLowerCase()
        const items = shortplays.filter((item) => !query || `${item.title} ${item.genre} ${item.intro}`.toLocaleLowerCase().includes(query)).map(({ episodes, ...item }) => item)
        send(res, { items })
        return
      }
      const seriesMatch = url.pathname.match(/^\/leisure-zone\/api\/shortplay\/series\/([^/]+)$/)
      if (seriesMatch) {
        const series = shortplays.find((item) => item.id === decodeURIComponent(seriesMatch[1]))
        if (!series) { send(res, { error: 'series not found' }, 404); return }
        send(res, { series: { id: series.id, title: series.title, genre: series.genre, episodeCount: series.episodeCount, cover: series.cover, intro: series.intro }, episodes: series.episodes })
        return
      }
      const playMatch = url.pathname.match(/^\/leisure-zone\/api\/shortplay\/series\/([^/]+)\/episodes\/([^/]+)\/play$/)
      if (playMatch) {
        const series = shortplays.find((item) => item.id === decodeURIComponent(playMatch[1]))
        const episode = series?.episodes.find((item) => item.id === decodeURIComponent(playMatch[2]))
        if (!series || !episode) { send(res, { error: 'episode not found' }, 404); return }
        send(res, { playable: false, reason: 'not-configured', fallback: 'android', seriesId: series.id, episodeId: episode.id })
        return
      }
      if (url.pathname === '/leisure-zone/api/shortplay/online/probe') {
        const never = undefined
        global.fetch?.(never) // 保持 no-op 注释下清晰；实际探测见下
        void never
        const https = await import('node:https')
        const hosts = ['api.fqnovel.com', 'api5-normal.fqnovel.com']
        const results = []
        for (const host of hosts) {
          const probeUrl = `https://${host}/novel/player/album_detail/v1/`
          await new Promise((resolve) => {
            const req = https.request(probeUrl, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0' }, timeout: 8000 }, (res) => {
              let chunk = ''
              res.on('data', (d) => { chunk += d })
              res.on('end', () => { results.push({ host, status: res.statusCode, reachable: true, sample: chunk.slice(0, 220) }); resolve() })
            })
            req.on('error', () => { results.push({ host, status: 0, reachable: false, sample: 'network error' }); resolve() })
            req.on('timeout', () => { req.destroy(); results.push({ host, status: 0, reachable: false, sample: 'timeout' }); resolve() })
            req.write('{"series_id":"probe"}')
            req.end()
          })
        }
        send(res, {
          probedAt: Date.now(),
          note: '字节系短剧 API 域名由 APK 静态分析得出；参数需登录上下文，此处仅验证域名可达性。',
          results,
        })
        return
      }
      if (url.pathname === '/leisure-zone/api/textbooks') {
        send(res, { textbooks: books.map(({ id, name, total }) => ({ id, name, total })) })
        return
      }
      if (url.pathname === '/leisure-zone/api/knowledge') {
        const data = await loadBook(textbookId)
        if (data === null) { send(res, { error: 'textbook unavailable', sections: [] }, 503); return }
        send(res, { total: data.total, sections: data.sections.map((section, sectionIndex) => ({
          title: section.title,
          kps: section.kps.map((kp, kpIndex) => ({
            id: `s${sectionIndex}-k${kpIndex}`,
            title: kp.title || `${(kp.concept || '').slice(0, 28)}…`,
            concept: kp.concept || '', law: kp.law || '', trap: kp.trap || '',
          })),
        })) })
        return
      }
      if (url.pathname === '/leisure-zone/api/mastered') {
        send(res, { ids: [...(mastered.get(textbookId) ?? new Set())] })
        return
      }
      if (url.pathname === '/leisure-zone/api/toggle' && req.method === 'POST') {
        let body = ''
        req.on('data', (chunk) => { body += chunk })
        req.on('end', () => {
          try {
            const args = JSON.parse(body || '{}')
            if (typeof args.id !== 'string' || args.id.length === 0) { send(res, { error: 'knowledge point id required' }, 400); return }
            const points = mastered.get(textbookId) ?? new Set()
            const isMastered = !points.has(args.id)
            if (isMastered) points.add(args.id); else points.delete(args.id)
            mastered.set(textbookId, points)
            send(res, { mastered: isMastered })
          } catch { send(res, { error: 'invalid json' }, 400) }
        })
        return
      }
      send(res, { error: 'not found' }, 404)
    },
  }), 'leisure-zone: API routes')
}
