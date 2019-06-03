const WXAPI = require('../../../wxapi/main')
var app = getApp();
Component({
  properties: {
    goodsId: {
      type: String
    },
    buyNum: {
      type: Number
    }
  },
  data: {
    buyNum: 0,
    shopCarInfo: {},
    goodsStore: 99999999999,
    price: 0,
    score: 0,
    hideSummaryPopup: true,
    totalPrice: 0,
    totalScore: 0
  },
  methods: {
    tapAddGoods: function(e) {
      this.setData({
        buyNum: this.properties.buyNum,
        hideSummaryPopup: false
      })

      var that = this;
      var buyNum = that.data.buyNum + 1;
      var stores = that.data.goodsStore;
      var goodsId = that.properties.goodsId;
      wx.showLoading({
        "mask": true
      });
      WXAPI.goodsDetail(goodsId).then(function (res) {
        wx.hideLoading();
        //有规格选择
        if (res.data.properties && res.data.properties.length > 0) {
          //that.getGoodsStore(goodsId);
          that.toDetailsTap(goodsId, false);
        } else { // 没有规格选择
          stores = res.data.basicInfo.stores;
          that.setData({
            goodsStore: stores
          });

          if (buyNum > stores) {
            wx.showModal({
              title: '提示',
              content: res.data.basicInfo.name + ' 库存不足，请重新购买',
              showCancel: false,
              duration: 200
            });
            return;
          }
          //更新购物车信息
          that.updateShopCarInfo(res.data);
        }
      });
    },

    toDetailsTap: function(goodsId, hideShopPopup) {
      wx.navigateTo({
        url: "/pages/goods-details/index?id=" + goodsId + "&hideShopPopup=" + hideShopPopup
      })
    },

    subGoods: function(e) {
      this.setData({
        buyNum: this.data.buyNum - 1
      })
      var shopCarInfo = wx.getStorageSync('shopCarInfo');
      if (shopCarInfo.shopList.length > 0) {
        for (var i = 0; i < shopCarInfo.shopList.length; i++) {
          var tmpShopCarMap = shopCarInfo.shopList[i];
          if (tmpShopCarMap.goodsId == this.properties.goodsId) {
            tmpShopCarMap.number = tmpShopCarMap.number - 1;
            if (tmpShopCarMap.number === 0) {
              tmpShopCarMap.active = false;
              shopCarInfo.shopList.splice(i, 1);
            }
            shopCarInfo.totalPrice = shopCarInfo.totalPrice - parseFloat(tmpShopCarMap.price);
            shopCarInfo.totalScore = shopCarInfo.totalScore - tmpShopCarMap.score;
            shopCarInfo.shopNum = shopCarInfo.shopNum - 1
            break;
          }
        }
      }
      shopCarInfo.totalPrice = parseFloat(shopCarInfo.totalPrice.toFixed(2));
      wx.setStorageSync("shopCarInfo", shopCarInfo);
      var data = {
        totalPrice: shopCarInfo.totalPrice,
        totalScore: shopCarInfo.totalScore,
        shopNum: shopCarInfo.shopNum
      };
      this.triggerEvent("totalPriceChange", data);
    },

    /**
     * 更新购物车信息
     */
    updateShopCarInfo: function(goodsDetail) {
      // 加入购物车
      var shopGood = this.getShopGoodInfo(goodsDetail);
      var shopCarInfo = this.getShopCarInfo();
      this.updateShopList(shopCarInfo.shopList, shopGood);

      // 计算购物车总件数， 总价格， 总积分
      shopCarInfo.shopNum = shopCarInfo.shopNum + 1;
      shopCarInfo.totalPrice = shopCarInfo.totalPrice + parseFloat(shopGood.price * 1);
      shopCarInfo.totalScore = shopCarInfo.totalScore + shopGood.score * 1;

      shopCarInfo.totalPrice = parseFloat(shopCarInfo.totalPrice.toFixed(2));
      //shopCarInfo.kjId = this.data.kjId;
      wx.setStorage({
        key: 'shopCarInfo',
        data: shopCarInfo
      })

      this.setData({
        buyNum: this.data.buyNum + 1,
        totalPrice: shopCarInfo.totalPrice,
        totalScore: shopCarInfo.totalScore,
        shopNum: shopCarInfo.shopNum
      });

      var data = {
        totalPrice: shopCarInfo.totalPrice,
        totalScore: shopCarInfo.totalScore,
        shopNum: shopCarInfo.shopNum
      };
      this.triggerEvent("totalPriceChange", data);
    },

    updateShopList: function(shopList, shopCarMap) {
      if (shopList.length === 0) {
        shopList.push(shopCarMap);
        return;
      }

      var hasSameGoodsIndex = -1;
      for (var i = 0; i < shopList.length; i++) {
        var tmpShopCarMap = shopList[i];
        if (tmpShopCarMap.goodsId == shopCarMap.goodsId && (!tmpShopCarMap.propertyChildIds ||tmpShopCarMap.propertyChildIds == shopCarMap.propertyChildIds)){
          hasSameGoodsIndex = i;
          shopCarMap.number = shopCarMap.number + tmpShopCarMap.number;
          break;
        }
      }

      if (hasSameGoodsIndex > -1) {
        shopList.splice(hasSameGoodsIndex, 1, shopCarMap);
      } else {
        shopList.push(shopCarMap);
      }
    },

    getShopCarInfo: function() {
      var shopCarInfo = wx.getStorageSync('shopCarInfo');

      if (!shopCarInfo || shopCarInfo === ""){
        shopCarInfo = {};
      }
      
      if (!shopCarInfo.shopList) {
        shopCarInfo.shopList = [];
      }

      if (!shopCarInfo.totalPrice) {
        shopCarInfo.totalPrice = 0;
      }

      if (!shopCarInfo.shopNum) {
        shopCarInfo.shopNum = 0;
      }

      if (!shopCarInfo.totalScore) {
        shopCarInfo.totalScore = 0;
      }

      return shopCarInfo;
    },

    getShopGoodInfo: function(goodsDetail) {
      return {
        goodsId: goodsDetail.basicInfo.id,
        pic: goodsDetail.basicInfo.pic, // 产品图片url
        name: goodsDetail.basicInfo.name,
        propertyChildIds: "", //产品规格信息
        label: "", //产品规格名称
        price: goodsDetail.basicInfo.minPrice, //选择产品规格的价格
        score: goodsDetail.basicInfo.minScore,
        left: "",
        active: true,
        number: 1,
        logisticsType: goodsDetail.basicInfo.logisticsId,
        logistics: goodsDetail.logistics,
        weight: goodsDetail.basicInfo.weight
      }
    },

    getGoodsStore: function(goodsId, propertyChildIds) {
      wx.request({
        url: app.globalData.subDomain + '/shop/goods/price',
        data: {
          goodsId: goodsId,
          propertyChildIds: propertyChildIds
        },
        success: function(res) {
          this.setData({
            goodsStore: res.data.stores,
            price: res.data.data.price,
            score: res.data.data.score
          });
        }
      })
      /*this.setData({
        goodsStore: 10,
        price: 125,
        score: 10
      });*/
    }
  },

  lifetimes: {
    attached() {
      /*var shopCarInfo = wx.getStorageSync('shopCarInfo');
       if (shopCarInfo.shopList.length > 0) {
         this.setData({
           hideSummaryPopup: false,
           totalPrice: shopCarInfo.totalPrice,
           totalScore: shopCarInfo.totalScore,
           shopNum: shopCarInfo.shopNum
         });
         
       }*/
    },
    detached() {
      // 在组件实例被从页面节点树移除时执行
    },
  }
})