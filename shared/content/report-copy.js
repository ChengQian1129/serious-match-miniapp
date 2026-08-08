const { CONTENT_VERSION, REPORT_COPY_VERSION } = require('./version')

module.exports = Object.freeze({
  CONTENT_VERSION,
  REPORT_COPY_VERSION,
  sections: Object.freeze([
    { id: 'overall', title: '目前比较明显的' },
    { id: 'interaction', title: '靠近一个人时' },
    { id: 'resource', title: '你比较能做到的' },
    { id: 'provide', title: '你通常会给出的' },
    { id: 'tension', title: '容易卡住的地方' },
    { id: 'observation', title: '值得留意的动作' }
  ]),
  confirmationLabels: Object.freeze({ fits: '你自己也觉得比较像', partly_fits: '你觉得有一部分像', does_not_fit: '你觉得不太像', unsure: '你暂时说不好' })
})
