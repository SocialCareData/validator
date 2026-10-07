/*
 * The Social Care page: its own header and footer around the generic
 * <data-standard-validator> element, configured with the Social Care standards.
 */

import './site.css'
import '@theodi/data-standard-validator-component'
import { config } from './config.js'

const element = document.querySelector('data-standard-validator')
if (!element) throw new Error('missing <data-standard-validator>')
element.config = config
