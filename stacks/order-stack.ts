import { Construct } from 'constructs'
import * as events from 'aws-cdk-lib/aws-events'
import { LambdaFunction as LambdaFunctionTarget } from 'aws-cdk-lib/aws-events-targets'
import * as nodeLambda from 'aws-cdk-lib/aws-lambda-nodejs'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as apigw from 'aws-cdk-lib/aws-apigateway'
import { BaseStack, BaseStackProps } from './base-stack'
import { RetentionDays } from 'aws-cdk-lib/aws-logs'
import { Runtime } from 'aws-cdk-lib/aws-lambda'

/**
 * Application to manage customer order
 *
 * An HTTP endpoint is created to receive orders from customers.
 * When an order is created, an Order.Created event is sent.
 * When a delivery update is received, the order is updated and an Order.Updated event is sent.
 */
export class OrderServiceStack extends BaseStack {
  localBus: events.EventBus

  constructor(scope: Construct, id: string, props: BaseStackProps) {
    super(scope, id, props)

    this.createOrderCreateFunction()
    this.createDeliveryUpdateFunction()
  }

  createOrderCreateFunction() {
    const createOrderFunction = new nodeLambda.NodejsFunction(
      this,
      'CreateOrderFunction',
      {
        entry: './src/order-handler.ts',
        handler: 'handleOrderCreate',
        runtime: Runtime.NODEJS_16_X,
        environment: {
          BUS_ARN: this.globalBus.eventBusArn,
        },
        logRetention: RetentionDays.ONE_WEEK,
        tracing: lambda.Tracing.ACTIVE,
      }
    )
    createOrderFunction.addToRolePolicy(this.globalBusPutEventsStatement)
    const api = new apigw.RestApi(this, 'OrderApi', { restApiName: 'order' })
    api.root.addMethod('POST', new apigw.LambdaIntegration(createOrderFunction))
  }

  createDeliveryUpdateFunction() {
    const deliveryUpdateFunction = new nodeLambda.NodejsFunction(
      this,
      'DeliveryUpdateFunction',
      {
        entry: './src/order-handler.ts',
        handler: 'handleDeliveryUpdate',
        runtime: Runtime.NODEJS_16_X,
        environment: {
          BUS_ARN: this.globalBus.eventBusArn,
        },
        logRetention: RetentionDays.ONE_WEEK,
        tracing: lambda.Tracing.ACTIVE,
      }
    )
    deliveryUpdateFunction.addToRolePolicy(this.globalBusPutEventsStatement)

    // React to delivery events
    new events.Rule(this, 'DeliveryHandlingRule', {
      eventBus: this.localBus,
      ruleName: 'order-service-rule',
      eventPattern: {
        detailType: ['Delivery.Updated'],
      },
    }).addTarget(new LambdaFunctionTarget(deliveryUpdateFunction))
  }
}
