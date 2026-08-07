const { getReport, replaceReport, shouldSyncAssessment } = require('../../utils/assessment-v2/session-store')
const { isCloudReady, getAssessmentFromCloud, saveAssessmentShareSettings } = require('../../utils/cloud')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')

function wrapText(context, text, maxWidth) {
  const lines = []
  let line = ''
  for (const character of text) {
    const next = line + character
    if (context.measureText(next).width > maxWidth && line) { lines.push(line); line = character } else line = next
  }
  if (line) lines.push(line)
  return lines
}

function categoryForClaim(claim) {
  if (claim.section === 'provide') return { id: 'provide', label: '我通常能提供' }
  if (claim.section === 'observation') return { id: 'observe', label: '认识我时' }
  return { id: 'value', label: '我比较看重' }
}

Page({
  data: { available: [], selectedIds: [], cardPath: '', canGenerate: false },
  onLoad() { this.loadOptions() },
  onShow() { resetNavigation(this); this.loadOptions() },
  loadOptions() {
    const report = getReport()
    if (!report) return
    this.report = report
    const confirmations = report.userConfirmations || {}
    const available = report.claims.filter(claim => claim.shareFragment && claim.section !== 'tension' && confirmations[claim.id] && ['fits', 'partly_fits'].includes(confirmations[claim.id].value)).map(claim => Object.assign({}, claim, { category: categoryForClaim(claim) }))
    const hasSavedSettings = Boolean(report.shareSettings && Array.isArray(report.shareSettings.selectedClaimIds))
    const savedIds = hasSavedSettings ? report.shareSettings.selectedClaimIds : []
    const selectedIds = savedIds.filter(id => available.some(claim => claim.id === id)).slice(0, 4)
    const fallbackIds = available.filter((claim, index, list) => list.findIndex(item => item.category.id === claim.category.id) === index).slice(0, 4).map(claim => claim.id)
    const finalIds = hasSavedSettings ? selectedIds : fallbackIds
    available.forEach(claim => { claim.selected = finalIds.includes(claim.id) })
    this.setData({ available, selectedIds: finalIds, canGenerate: finalIds.length > 0 })
    if (!this._cloudSettingsLoaded && shouldSyncAssessment() && isCloudReady() && report.assessmentId) {
      this._cloudSettingsLoaded = true
      getAssessmentFromCloud(report.assessmentId, { success: data => {
        if (this._shareUpdateSequence || !data.report || Number(data.report.reportVersion) !== Number(report.reportVersion)) return
        replaceReport(data.report)
        this.loadOptions()
      } })
    }
  },
  toggleClaim(event) {
    const id = event.currentTarget.dataset.id
    const selected = this.data.selectedIds.includes(id)
    let selectedIds = selected ? this.data.selectedIds.filter(item => item !== id) : this.data.selectedIds.concat(id)
    if (selectedIds.length > 4) { wx.showToast({ title: '最多选择四条', icon: 'none' }); return }
    this._shareUpdateSequence = Number(this._shareUpdateSequence || 0) + 1
    const updateSequence = this._shareUpdateSequence
    const updatedAt = Date.now() * 1000 + updateSequence
    const report = Object.assign({}, this.report, { shareSettings: { selectedClaimIds, updatedAt } })
    replaceReport(report)
    this.report = report
    this.setData({ selectedIds, available: this.data.available.map(claim => Object.assign({}, claim, { selected: selectedIds.includes(claim.id) })), canGenerate: selectedIds.length > 0, cardPath: '' })
    if (shouldSyncAssessment() && isCloudReady() && report._id) saveAssessmentShareSettings(report._id, selectedIds, updatedAt, { success: data => { if (updateSequence === this._shareUpdateSequence && data.shareSettings) { this.report = Object.assign({}, this.report, { shareSettings: data.shareSettings }); replaceReport(this.report) } } })
  },
  generateCard() {
    if (!this.data.canGenerate) return
    const selectedClaims = this.data.available.filter(claim => this.data.selectedIds.includes(claim.id))
    wx.createSelectorQuery().select('#shareCanvas').fields({ node: true, size: true }).exec(result => {
      const target = result && result[0]
      if (!target || !target.node) return wx.showToast({ title: '名片生成失败，请重试', icon: 'none' })
      const canvas = target.node
      const context = canvas.getContext('2d')
      const ratio = wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : 2
      canvas.width = 640 * ratio; canvas.height = 900 * ratio; context.scale(ratio, ratio)
      context.fillStyle = '#F7F2EA'; context.fillRect(0, 0, 640, 900)
      context.fillStyle = '#17151B'; context.fillRect(0, 0, 640, 12)
      context.font = '600 22px sans-serif'; context.fillStyle = '#6A625B'; context.fillText('关系说明书', 48, 72)
      context.font = '700 48px sans-serif'; context.fillStyle = '#17151B'; context.fillText('我的相处名片', 48, 148)
      let y = 220
      ;['value', 'provide', 'observe'].forEach(categoryId => {
        const claims = selectedClaims.filter(claim => claim.category.id === categoryId)
        if (!claims.length || y > 700) return
        context.font = '600 22px sans-serif'; context.fillStyle = '#A34A36'; context.fillText(claims[0].category.label, 48, y); y += 34
        context.font = '700 30px sans-serif'; context.fillStyle = '#17151B'
        claims.forEach(claim => { wrapText(context, claim.shareFragment, 500).slice(0, 3).forEach(line => { if (y <= 700) { context.fillText(line, 48, y); y += 42 } }); y += 18 })
      })
      context.strokeStyle = '#CEC4B8'; context.beginPath(); context.moveTo(48, 748); context.lineTo(592, 748); context.stroke()
      context.font = '24px sans-serif'; context.fillStyle = '#6A625B'
      wrapText(context, '来自当前自述并经本人核对，不是人格诊断。', 530).forEach((line, index) => context.fillText(line, 48, 804 + index * 38))
      wx.canvasToTempFilePath({ canvas, width: 640, height: 900, destWidth: 1280, destHeight: 1800, success: output => this.setData({ cardPath: output.tempFilePath }), fail: () => wx.showToast({ title: '名片生成失败，请重试', icon: 'none' }) })
    })
  },
  saveCard() {
    if (!this.data.cardPath) return
    const save = () => wx.saveImageToPhotosAlbum({
      filePath: this.data.cardPath,
      success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
      fail: error => {
        const detail = String(error && (error.errMsg || error.message) || '')
        if (/auth deny|authorize|permission/i.test(detail) && typeof wx.authorize === 'function') {
          return wx.authorize({ scope: 'scope.writePhotosAlbum', success: save, fail: () => wx.showToast({ title: '未能保存，请在设置中允许相册权限', icon: 'none' }) })
        }
        wx.showToast({ title: '未能保存，请检查相册权限', icon: 'none' })
      }
    })
    save()
  },
  returnReport() { navigateOnce(this, 'navigateBack', { fail: () => navigateOnce(this, 'reLaunch', { url: '/pages/questionnaire-result/index' }) }) },
  onShareAppMessage() { return { title: '我的相处名片', path: '/pages/home/index', imageUrl: this.data.cardPath || undefined } }
})
