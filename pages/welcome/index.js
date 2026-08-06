const { hasSeenWelcome, markWelcomeSeen, recordEvent } = require('../../utils/storage')
const { navigateOnce, resetNavigation } = require('../../utils/navigation')
const { getStatusBarHeight } = require('../../utils/window')

Page({
  data: {
    statusBarHeight: getStatusBarHeight(),
    currentSlide: 0,
    slideDots: [0, 1, 2],
    isLastSlide: false,
    slides: [
      { kicker: '01  看见自己', title: '关系，不是一个答案。', desc: '在靠近另一个人之前，先留一点时间给自己。', meta: '从当下的感受开始，慢慢看见自己的位置。' },
      { kicker: '02  整理线索', title: '把模糊的感觉，变成线索。', desc: '用一组有依据的关系问题，整理你如何靠近、回应和表达需要。', meta: '这是一次关系探索，不是心理诊断。' },
      { kicker: '03  形成底图', title: '留下自己的关系底图。', desc: '回答会形成一份可以回看、修改和继续补充的个人记录。', meta: '参考关系科学研究框架，当前版本为项目自编探索。' }
    ]
  },

  onShow() {
    resetNavigation(this)
    if (hasSeenWelcome()) {
      navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
      return
    }
    recordEvent('welcome_view')
  },

  next() {
    if (this._isRouting) return
    if (!this.data.isLastSlide) {
      const currentSlide = this.data.currentSlide + 1
      this.setData({ currentSlide, isLastSlide: currentSlide === 2 })
      recordEvent('welcome_slide', { slide: currentSlide + 1 })
      return
    }
    this.enterApp('welcome_begin')
  },

  skip() {
    if (this._isRouting) return
    this.enterApp('welcome_skip')
  },

  enterApp(eventName) {
    markWelcomeSeen()
    recordEvent(eventName)
    navigateOnce(this, 'reLaunch', { url: '/pages/home/index' })
  }
})
