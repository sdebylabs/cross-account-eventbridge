import { Construct } from 'constructs'
import * as events from 'aws-cdk-lib/aws-events'
import { LambdaFunction as LambdaFunctionTarget } from 'aws-cdk-lib/aws-events-targets'
import * as nodeLambda from 'aws-cdk-lib/aws-lambda-nodejs'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import { BaseStack, BaseStackProps } from './base-stack'
import { Duration } from 'aws-cdk-lib'
import { RetentionDays } from 'aws-cdk-lib/aws-logs'
import { Runtime } from 'aws-cdk-lib/aws-lambda'

/**
 * Application to handle deliveries for orders
 *
 * When an Order.Created event is received, this application "delivers" the order
 */
export class DeliveryServiceStack extends BaseStack {
  localBus: events.EventBus

  constructor(scope: Construct, id: string, props: BaseStackProps) {
    super(scope, id, props)

    this.createOrderDeliveryFunction()
  }

  createOrderDeliveryFunction() {
    const orderDeliveryFunction = new nodeLambda.NodejsFunction(
      this,
      'OrderDeliveryFunction',
      {
        entry: './src/delivery-handler.ts',
        handler: 'handleOrderCreated',
        runtime: Runtime.NODEJS_16_X,
        environment: {
          BUS_ARN: this.globalBus.eventBusArn,
        },
        timeout: Duration.seconds(10),
        logRetention: RetentionDays.ONE_WEEK,
        tracing: lambda.Tracing.ACTIVE,
      }
    )
    orderDeliveryFunction.addToRolePolicy(this.globalBusPutEventsStatement)

    // The delivery function reacts to orders being created
    new events.Rule(this, 'OrderDeliveryRule', {
      eventBus: this.localBus,
      ruleName: 'order-delivery-rule',
      eventPattern: {
        detailType: ['Order.Created'],
      },
      targets: [new LambdaFunctionTarget(orderDeliveryFunction)],
    })
  }
}
