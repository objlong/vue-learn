import Dep from './dep'
import { arrayMethods } from './array'
import {
  def,
  isArray,
  isPlainObject,
  hasProto,
  hasOwn
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * By default, when a reactive property is set, the new value is
 * also converted to become reactive. However in certain cases, e.g.
 * v-for scope alias and props, we don't want to force conversion
 * because the value may be a nested value under a frozen data structure.
 *
 * So whenever we want to set a reactive property without forcing
 * conversion on the new value, we wrap that call inside this function.
 */

let shouldConvert = true
export function withoutConversion (fn) {
  shouldConvert = false
  fn()
  shouldConvert = true
}

/**
 * Observer class that are attached to each observed
 * object. Once attached, the observer converts target
 * object's property keys into getter/setters that
 * collect dependencies and dispatches updates.
 *
 * @param {Array|Object} value
 * @constructor
 */

export function Observer (value) {
  //将传参value挂载到this上
  this.value = value
  //将依赖收集对象实例化，挂载到this上
  //构造函数Dep跳转至./dep
  this.dep = new Dep()
  //Object.definePropert封装../util/lang
  //将Observer实例化后的对象挂载到value.__ob__下
  def(value, '__ob__', this)
  if (isArray(value)) {
    //由于数组的特殊性，若用Object.defineProperty，存在以下问题：
    //1.将数字作为属性存在性能问题
    //2.无法解决push pop等数组方法
    //解决方案：
    //重写数组方法,由于es5继承数组方法是返回新数组,所以得用特别的继承方式
    //(1):利用大部分高级浏览器的__proto__属性，指向Array.prototype里的方法
    //(2):遍历，将方法def到数组实例上
    //hasProto:from ../util/env
    //protoAugment:方案(1)
    //copyAugment:方案(2)
    //arrayMethods:重写方法 from ./array
    var augment = hasProto
      ? protoAugment
      : copyAugment
    augment(value, arrayMethods, arrayKeys)
    this.observeArray(value)
  } else {
    //walk:遍历
    this.walk(value)
  }
}

// Instance methods

/**
 * Walk through each property and convert them into
 * getter/setters. This method should only be called when
 * value type is Object.
 *
 * @param {Object} obj
 */

Observer.prototype.walk = function (obj) {
  var keys = Object.keys(obj)
  for (var i = 0, l = keys.length; i < l; i++) {
    //convert: 遍历设置getter和setter
    this.convert(keys[i], obj[keys[i]])
  }
}

/**
 * Observe a list of Array items.
 *
 * @param {Array} items
 */

Observer.prototype.observeArray = function (items) {
  for (var i = 0, l = items.length; i < l; i++) {
    observe(items[i])
  }
}

/**
 * Convert a property into getter/setter so we can emit
 * the events when the property is accessed/changed.
 *
 * @param {String} key
 * @param {*} val
 */

Observer.prototype.convert = function (key, val) {
  defineReactive(this.value, key, val)
}

/**
 * Add an owner vm, so that when $set/$delete mutations
 * happen we can notify owner vms to proxy the keys and
 * digest the watchers. This is only called when the object
 * is observed as an instance's root $data.
 *
 * @param {Vue} vm
 */

Observer.prototype.addVm = function (vm) {
  (this.vms || (this.vms = [])).push(vm)
}

/**
 * Remove an owner vm. This is called when the object is
 * swapped out as an instance's $data object.
 *
 * @param {Vue} vm
 */

Observer.prototype.removeVm = function (vm) {
  this.vms.$remove(vm)
}

// helpers

/**
 * Augment an target Object or Array by intercepting
 * the prototype chain using __proto__
 *
 * @param {Object|Array} target
 * @param {Object} src
 */

function protoAugment (target, src) {
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment an target Object or Array by defining
 * hidden properties.
 *
 * @param {Object|Array} target
 * @param {Object} proto
 */

function copyAugment (target, src, keys) {
  for (var i = 0, l = keys.length; i < l; i++) {
    var key = keys[i]
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 *
 * @param {*} value
 * @param {Vue} [vm]
 * @return {Observer|undefined}
 * @static
 */

export function observe (value, vm) {
  if (!value || typeof value !== 'object') {
    //判断是否为对象
    return
  }
  var ob
  if (
    //__ob__这个属性若存在，证明已经observe过。直接赋值ob
    hasOwn(value, '__ob__') &&
    value.__ob__ instanceof Observer
  ) {
    ob = value.__ob__
  } else if (
    //shouldConvert:开关，暂不知道其作用
    //Object.isExtensible：判断该对象是否可以添加新属性
    shouldConvert &&
    (isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) {
    //构造函数Observer，看返回值。
    ob = new Observer(value)
  }
  if (ob && vm) {
    //vm: 当前实例
    //addVm：将vm添加到ob的vms属性中
    ob.addVm(vm)
  }
  //最后输出的ob应是一个可以get和set的对象
  return ob
}

/**
 * Define a reactive property on an Object.
 *
 * @param {Object} obj
 * @param {String} key
 * @param {*} val
 */

export function defineReactive (obj, key, val) {
  //dep:阅读完本段代码跳至./dep,是一个收集watcher的构造函数。很多资料中称之为依赖收集
  var dep = new Dep()
  //Object.getOwnPropertyDescriptor:获取属性描述符，如writable等
  var property = Object.getOwnPropertyDescriptor(obj, key)
  //configurable:false不可更改与扩展
  if (property && property.configurable === false) {
    return
  }

  // cater for pre-defined getter/setters
  var getter = property && property.get
  var setter = property && property.set

  var childOb = observe(val)
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter () {
      //判断value值是否有getter
      var value = getter ? getter.call(obj) : val
      if (Dep.target) {
        //当watcher发生变化时，触发所有依赖的getter
        //然后存储依赖于此的订阅者dep.depend()相当于dep.addSub(Dep.target)
        //这样watcher成功的分发到了相关依赖中。
        //可以理解为解决getter不能传参但需要传参的情况
        dep.depend()
        if (childOb) {
          //Observer构造函数中已经声明this.dep = new Dep();
          childOb.dep.depend()
        }
        if (isArray(value)) {
          for (var e, i = 0, l = value.length; i < l; i++) {
            e = value[i]
            e && e.__ob__ && e.__ob__.dep.depend()
          }
        }
      }
      return value
    },
    set: function reactiveSetter (newVal) {
      var value = getter ? getter.call(obj) : val
      if (newVal === value) {
        return
      }
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      childOb = observe(newVal)
      //通知更新
      dep.notify()
    }
  })
}
