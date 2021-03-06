import { Component } from 'react'
import { observe, unobserve } from '@nx-js/observer-util'
import autoBind from './autoBind'

export default function view (Comp) {
  const isStatelessComp = !(Comp.prototype && Comp.prototype.isReactComponent)
  const BaseComp = isStatelessComp ? Component : Comp
  // return a HOC which overwrites render, shouldComponentUpdate and componentWillUnmount
  // it decides when to run the new reactive methods and when to proxy to the original methods
  class ReactiveHOC extends BaseComp {
    constructor (props, context) {
      super(props, context)
      this.state = this.state || {}

      if (!isStatelessComp) {
        // auto bind non react specific original methods to the component instance
        autoBind(this, Comp.prototype, true)
      }

      // create a reactive render for the component
      this.render = observe(this.render, {
        scheduler: () => this.setState(this.state),
        lazy: true
      })
    }

    render () {
      return isStatelessComp ? Comp(this.props, this.context) : super.render()
    }

    // react should trigger updates on prop changes, while easyState handles store changes
    shouldComponentUpdate (nextProps, nextState) {
      const { props, state } = this

      // respect the case when user prohibits updates
      if (
        super.shouldComponentUpdate &&
        !super.shouldComponentUpdate(nextProps, nextState)
      ) {
        return false
      }

      // return true if it is a reactive render or state changes
      if (state !== nextState) {
        return true
      }

      // the component should update if any of its props shallowly changed value
      const keys = Object.keys(props)
      const nextKeys = Object.keys(nextProps)
      return (
        nextKeys.length !== keys.length ||
        nextKeys.some(key => props[key] !== nextProps[key])
      )
    }

    componentWillUnmount () {
      // call user defined componentWillUnmount
      if (super.componentWillUnmount) {
        super.componentWillUnmount()
      }
      // clean up memory used by easyState
      unobserve(this.render)
    }
  }
  // proxy react specific static variables to the reactive component
  copyStaticProps(Comp, ReactiveHOC)
  return ReactiveHOC
}

// copy react specific static props between passed and HOC components
function copyStaticProps (fromComp, toComp) {
  toComp.displayName = fromComp.displayName || fromComp.name
  toComp.contextTypes = fromComp.contextTypes
  toComp.childContextTypes = fromComp.childContextTypes
  toComp.propTypes = fromComp.propTypes
  toComp.defaultProps = fromComp.defaultProps
}
