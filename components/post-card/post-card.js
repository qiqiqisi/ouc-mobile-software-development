Component({
  properties: {
    post: {
      type: Object,
      value: {}
    },
    showAuthor: {
      type: Boolean,
      value: true
    }
  },

  methods: {
    onTapCard() {
      this.triggerEvent('tapcard', { post: this.properties.post })
    },

    onTapAuthor() {
      this.triggerEvent('tapauthor', { post: this.properties.post })
    },
    onTapLike() {
      this.triggerEvent('like', { post: this.properties.post })
    }
  }
})
