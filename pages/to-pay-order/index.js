const app = getApp()
const WXAPI = require('../../wxapi/main')

Page({
  data: {
    totalScoreToPay: 0,
    goodsList: [],
    isNeedLogistics: 0, // 是否需要物流信息
    allGoodsPrice: 0,
    yunPrice: 0,
    allGoodsAndYunPrice: 0,
    goodsJsonStr: "",
    orderType: "", //订单类型，购物车下单或立即支付下单，默认是购物车，
    pingtuanOpenId: undefined, //拼团的话记录团号
    expected_date: undefined,

    hasNoCoupons: true,
    coupons: [],
    youhuijine: 0, //优惠券金额
    multiIndex: [0, 0, 0],
    multiArray: [],
    curCoupon: null // 当前选择使用的优惠券
  },
  onShow: function () {
    var that = this;
    var shopList = [];
    //立即购买下单
    if ("buyNow" == that.data.orderType) {
      var buyNowInfoMem = wx.getStorageSync('buyNowInfo');
      that.data.kjId = buyNowInfoMem.kjId;
      if (buyNowInfoMem && buyNowInfoMem.shopList) {
        shopList = buyNowInfoMem.shopList
      }
    } else {
      //购物车下单
      var shopCarInfoMem = wx.getStorageSync('shopCarInfo');
      that.data.kjId = shopCarInfoMem.kjId;
      if (shopCarInfoMem && shopCarInfoMem.shopList) {
        // shopList = shopCarInfoMem.shopList
        shopList = shopCarInfoMem.shopList.filter(entity => {
          return entity.active;
        });
      }
    }
    that.setData({
      goodsList: shopList,
    });
    that.initShippingAddress();
  },

  onLoad: function (e) {
    let _data = {
      isNeedLogistics: 1,
      orderType: e.orderType
    }
    if (e.pingtuanOpenId) {
      _data.pingtuanOpenId = e.pingtuanOpenId
    }
    this.setData(_data);
    this.buildDateRange();
  },

  getDistrictId: function (obj, aaa) {
    if (!obj) {
      return "";
    }
    if (!aaa) {
      return "";
    }
    return aaa;
  },

  createOrder: function (e) {
    var that = this;
    var loginToken = wx.getStorageSync('token') // 用户登录 token
    var remark = ""; // 备注信息
    var expected_date = "";
    if (e) {
      remark = e.detail.value.remark; // 备注信息
      expected_date = that.data.expected_date; // 备注信息
      if (!expected_date) {
        wx.showModal({
          title: '提示',
          content: '请选择送货日期',
          showCancel: false
        })
        return
      }
    }

    var postData = {
      token: loginToken,
      goodsJsonStr: that.data.goodsJsonStr,
      expected_date: expected_date,
      remark: remark
    };
    if (that.data.kjId) {
      postData.kjid = that.data.kjId
    }
    if (that.data.pingtuanOpenId) {
      postData.pingtuanOpenId = that.data.pingtuanOpenId
    }
    if (that.data.isNeedLogistics > 0) {
      if (!that.data.curAddressData) {
        wx.hideLoading();
        wx.showModal({
          title: '错误',
          content: '请先设置您的收货地址！',
          showCancel: false
        })
        return;
      }
      postData.provinceId = that.data.curAddressData.provinceId;
      postData.cityId = that.data.curAddressData.cityId;
      if (that.data.curAddressData.districtId) {
        postData.districtId = that.data.curAddressData.districtId;
      }
      postData.address = that.data.curAddressData.address;
      postData.linkMan = that.data.curAddressData.linkMan;
      postData.mobile = that.data.curAddressData.mobile;
      postData.code = that.data.curAddressData.code;
    }
    if (that.data.curCoupon) {
      postData.couponId = that.data.curCoupon.id;
    }
    if (!e) {
      postData.calculate = "true";
    }

    wx.showLoading({
      mask: true,
      title: '提交中...'
    });
    WXAPI.orderCreate(postData).then(function (res) {
      if (res.code != 0) {
        if (res.code == -4) {
          wx.removeStorageSync('userid');
          app.bindChanged = true;
        }
        wx.hideLoading();
        wx.showModal({
          title: '错误',
          content: res.msg,
          showCancel: false
        })
        return;
      }

      if (e && "buyNow" != that.data.orderType) {
        // 清空购物车数据
        wx.setStorageSync("shopCarInfo", {});
      }
      if (!e) {
        that.setData({
          totalScoreToPay: res.data.score,
          isNeedLogistics: res.data.isNeedLogistics,
          allGoodsPrice: res.data.amountTotle,
          allGoodsAndYunPrice: parseFloat((res.data.amountLogistics + res.data.amountTotle).toFixed(2)),
          yunPrice: res.data.amountLogistics
        });
        that.getMyCoupons();
        wx.hideLoading();
        return;
      }
      WXAPI.addTempleMsgFormid({
        token: wx.getStorageSync('token'),
        type: 'form',
        formId: e.detail.formId
      })
      // 配置模板消息推送
      var postJsonString = {};
      postJsonString.keyword1 = {
        value: res.data.dateAdd,
        color: '#173177'
      }
      postJsonString.keyword2 = {
        value: res.data.amountReal + '元',
        color: '#173177'
      }
      postJsonString.keyword3 = {
        value: res.data.orderNumber,
        color: '#173177'
      }
      postJsonString.keyword4 = {
        value: '订单已关闭',
        color: '#173177'
      }
      postJsonString.keyword5 = {
        value: '您可以重新下单，请在30分钟内完成支付',
        color: '#173177'
      }
      WXAPI.sendTempleMsg({
        module: 'order',
        business_id: res.data.id,
        trigger: -1,
        postJsonString: JSON.stringify(postJsonString),
        template_id: 'mGVFc31MYNMoR9Z-A9yeVVYLIVGphUVcK2-S2UdZHmg',
        type: 0,
        token: wx.getStorageSync('token'),
        url: 'pages/index/index'
      })
      postJsonString = {};
      postJsonString.keyword1 = {
        value: '您的订单已发货，请注意查收',
        color: '#173177'
      }
      postJsonString.keyword2 = {
        value: res.data.orderNumber,
        color: '#173177'
      }
      postJsonString.keyword3 = {
        value: res.data.dateAdd,
        color: '#173177'
      }
      WXAPI.sendTempleMsg({
        module: 'order',
        business_id: res.data.id,
        trigger: 2,
        postJsonString: JSON.stringify(postJsonString),
        template_id: 'Arm2aS1rsklRuJSrfz-QVoyUzLVmU2vEMn_HgMxuegw',
        type: 0,
        token: wx.getStorageSync('token'),
        url: 'pages/order-details/index?id=' + res.data.id
      })
      // 下单成功，跳转到订单管理界面
      wx.redirectTo({
        url: "/pages/order-list/index"
      });
    })
  },
  initShippingAddress: function () {
    var that = this;
    WXAPI.defaultAddress(wx.getStorageSync('token')).then(function (res) {
      if (res.code == 0) {
        that.setData({
          curAddressData: res.data
        });
      } else {
        that.setData({
          curAddressData: null
        });
      }
      that.processYunfei();
    })
  },
  processYunfei: function () {
    var that = this;
    var goodsList = this.data.goodsList;
    var goodsJsonStr = "[";
    var isNeedLogistics = 0;
    var allGoodsPrice = 0;

    for (let i = 0; i < goodsList.length; i++) {
      let carShopBean = goodsList[i];
      if (carShopBean.logistics) {
        isNeedLogistics = 1;
      }
      allGoodsPrice += carShopBean.price * carShopBean.number;

      var goodsJsonStrTmp = '';
      if (i > 0) {
        goodsJsonStrTmp = ",";
      }


      let inviter_id = 0;
      let inviter_id_storge = wx.getStorageSync('inviter_id_' + carShopBean.goodsId);
      if (inviter_id_storge) {
        inviter_id = inviter_id_storge;
      }


      goodsJsonStrTmp += '{"goodsId":' + carShopBean.goodsId + ',"number":' + carShopBean.number + ',"propertyChildIds":"' + carShopBean.propertyChildIds + '","logisticsType":0, "inviter_id":' + inviter_id + '}';
      goodsJsonStr += goodsJsonStrTmp;


    }
    goodsJsonStr += "]";
    //console.log(goodsJsonStr);
    that.setData({
      isNeedLogistics: isNeedLogistics,
      goodsJsonStr: goodsJsonStr
    });
    that.createOrder();
  },
  addAddress: function () {
    wx.navigateTo({
      url: "/pages/address-add/index"
    })
  },
  selectAddress: function () {
    wx.navigateTo({
      url: "/pages/select-address/index"
    })
  },
  getMyCoupons: function () {
    var that = this;
    WXAPI.myCoupons({
      token: wx.getStorageSync('token'),
      status: 0
    }).then(function (res) {
      if (res.code == 0) {
        var coupons = res.data.filter(entity => {
          return entity.moneyHreshold <= that.data.allGoodsAndYunPrice;
        });
        if (coupons.length > 0) {
          that.setData({
            hasNoCoupons: false,
            coupons: coupons
          });
        }
      }
    })
  },
  bindDateChange: function (e) {
    this.setData({
      expected_date: e.detail.value
    })
  },
  bindChangeCoupon: function (e) {
    const selIndex = e.detail.value[0] - 1;
    if (selIndex == -1) {
      this.setData({
        youhuijine: 0,
        curCoupon: null
      });
      return;
    }
    //console.log("selIndex:" + selIndex);
    this.setData({
      youhuijine: this.data.coupons[selIndex].money,
      curCoupon: this.data.coupons[selIndex]
    });
  },
  buildDateRange: function () {
    var multiArray = [];
    let dateRangeArray = this.getDateRangeArray(1, 10);
    multiArray.push(dateRangeArray);

    let hourRange = this.getSubRange(3, 24);
    multiArray.push(hourRange);

    let minuteRange = [{ des: "00" }, { des: "15" }, { des: "30" }, { des: "45" }];
    multiArray.push(minuteRange);

    this.setData({
      multiArray: multiArray
    });

    this.setSelectedDate(this.data.multiIndex, multiArray);
  },

  getDateRangeArray: function (start, end) {
    var dateRangeArray = [];
    var millonSeconds = 24 * 60 * 60 * 1000;
    var curDate = new Date();
    for (var i = start; i <= end; i++) {
      var date = new Date(curDate.getTime() + 24 * 60 * 60 * 1000 * i);
      var year = date.getFullYear();
      var month = date.getMonth() + 1;
      var day = date.getDate();
      var value = year + "-" + month + "-" + day;
      var monthAndDay = month + "月" + day + "日";
      var dateStr = { des: monthAndDay, value: value };

      if (i === 0) {
        dateStr = { des: "今天" + "(" + monthAndDay + ")", value: value };
      }
      if (i === 1) {
        dateStr = { des: "明天" + "(" + monthAndDay + ")", value: value };
      }
      if (i === 2) {
        dateStr = { des: "后天" + "(" + monthAndDay + ")", value: value };
      }

      dateRangeArray.push(dateStr);
    }
    return dateRangeArray;
  },

  getSubRange: function (start, end) {
    let range = [];
    for (var i = start; i <= end; i++) {
      var item = i;
      if (i < 10) {
        item = "0" + i;
      }
      range.push({ des: item });
    }
    return range;
  },

  bindMultiPickerChange: function (e) {
    var multiIndex = e.detail.value;
    this.setSelectedDate(multiIndex, this.data.multiArray);
  },

  setSelectedDate: function (multiIndex, multiArray) {
    var expected_date = multiArray[0][multiIndex[0]].value + " " + multiArray[1][multiIndex[1]].des
      + ":" + multiArray[2][multiIndex[2]].des + ":00";
    this.setData({
      multiIndex: multiIndex,
      expected_date: expected_date
    })
  },

  bindMultiPickerColumnChange: function (e) {
    var data = {
      multiArray: this.data.multiArray,
      multiIndex: this.data.multiIndex
    };
    data.multiIndex[e.detail.column] = e.detail.value;
    this.setData(data);
  }
})