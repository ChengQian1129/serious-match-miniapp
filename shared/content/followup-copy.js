const { CONTENT_VERSION } = require('./version')

module.exports = Object.freeze({
  CONTENT_VERSION,
  entry: Object.freeze({
    title: '如果你愿意，可以再聊聊。',
    body: '有些事靠选择题问不清。我们会邀请一部分人做一对一访谈，也可能组织大连的线下交流。要不要参加都由你自己决定。',
    action: '了解一下'
  }),
  intro: Object.freeze({
    kicker: '',
    title: '如果你愿意，我们可以继续聊。',
    body: '后面可能会邀请你做一对一访谈、聊聊这套题哪里难理解，或者参加大连的线下交流。这些都不是答题的一部分，不参加也不会影响你看结果。',
    safety: '你的资料不会自动给其他用户看。每一次邀请都会先说明是什么，再由你决定要不要参加。',
    primary: '看看有哪些选择',
    secondary: '先不用'
  }),
  settings: Object.freeze({
    kicker: '',
    title: '你愿意接受哪些后续联系？',
    description: '下面几件事分开选择，默认都不勾选，以后也可以改。',
    save: '保存',
    manageProfile: '修改联系资料',
    fillProfile: '填写联系资料',
    deleteTitle: '不再参加后续活动？',
    deleteBody: '删除后，我们会删除用于后续联系的授权、联系方式、后续联系资料和相关访谈记录。你的问卷和结果不会受影响。',
    deleteConfirm: '确认删除',
    deleteCancel: '取消',
    deleteAction: '删除后续联系资料'
  }),
  scopes: Object.freeze({
    interview_contact: Object.freeze({ title: '可以联系我做一对一访谈', description: '如果有合适的访谈，可以通过你留下的联系方式邀请你。打开这一项后才需要填写联系方式。' }),
    research_use: Object.freeze({ title: '可以用不含身份信息的回答改进这套题', description: '分析时会先去掉能直接识别你的信息，用来看看哪些题和结果还需要修改。不需要留下联系方式。' }),
    offline_invitation: Object.freeze({ title: '可以联系我参加线下活动', description: '如果之后在大连有合适的交流活动，可以给你发邀请。每次要不要参加，都由你自己决定。' })
  }),
  profile: Object.freeze({
    kicker: '联系资料',
    title: '怎么联系你？',
    description: '只留真正联系需要的信息。\n\n不用填写择偶条件，也不会自动公开给别人。',
    displayName: '称呼',
    displayNamePlaceholder: '例如：小陈',
    cityArea: '大概在哪',
    cityAreaPlaceholder: '例如：高新区 / 沙河口',
    availability: '一般什么时候方便联系',
    availabilityPlaceholder: '例如：工作日晚 8 点后',
    channel: '你希望我们怎么联系',
    value: '联系方式',
    note: '还有什么需要提前知道？（可不填）',
    notePlaceholder: '例如：更方便文字联系；周末白天比较方便',
    save: '保存',
    back: '返回',
    participantRequiredError: '请先填写称呼、所在区域和方便联系的时间',
    channelRequiredError: '请先选择一种联系方式',
    contactRequiredError: '请填写你选择的联系方式',
    phoneError: '手机号需要填写 7–15 位数字，可包含国家区号',
    emailError: '请填写有效的邮箱地址，例如 name@example.com',
    wechatError: '微信号不能包含空格，请检查后再试',
    consentError: '请先选择需要联系的参与方式'
  }),
  channels: Object.freeze({ wechat: '微信号', phone: '手机号', email: '邮箱', other: '其他' }),
  contactFields: Object.freeze({
    wechat: Object.freeze({ label: '微信号', placeholder: '例如：wxid_xxxxx 或你的微信号', inputType: 'text', maxLength: 64, hint: '只填写微信号，不需要加“微信号：”等前缀。' }),
    phone: Object.freeze({ label: '手机号', placeholder: '例如：13800138000', inputType: 'number', maxLength: 24, hint: '可以填写国家区号；我们只会用它联系你。' }),
    email: Object.freeze({ label: '邮箱', placeholder: '例如：name@example.com', inputType: 'text', maxLength: 160, hint: '请确认这个邮箱能够收到后续联系。' }),
    other: Object.freeze({ label: '其他联系方式', placeholder: '输入你方便留下的联系方式', inputType: 'text', maxLength: 160, hint: '例如：Telegram 用户名、备用联系方式等。' })
  })
})
