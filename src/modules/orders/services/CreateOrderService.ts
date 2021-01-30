import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const findCustomerById = await this.customersRepository.findById(
      customer_id,
    );

    if (!findCustomerById) {
      throw new AppError('Customer does not exist.');
    }

    const findAllProductsById = await this.productsRepository.findAllById(
      products,
    );

    if (findAllProductsById.length <= 0) {
      throw new AppError("There are no products with these ID's.");
    }

    const productsIds = findAllProductsById.map(product => product.id);

    const checkProductsNotExist = products.filter(
      product => !productsIds.includes(product.id),
    );

    if (checkProductsNotExist.length > 0) {
      throw new AppError(`Does not exist product: ${checkProductsNotExist}`);
    }

    const findProductsWithNoQuantityAvailable = products.filter(
      product =>
        findAllProductsById.filter(p => p.id === product.id)[0].quantity <
        product.quantity,
    );

    if (findProductsWithNoQuantityAvailable.length > 0) {
      throw new AppError(
        `Quantity product: ${findProductsWithNoQuantityAvailable}`,
      );
    }

    const productsFormat = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: findAllProductsById.filter(p => p.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: findCustomerById,
      products: productsFormat,
    });

    const orderProductsQuantity = products.map(product => ({
      id: product.id,
      quantity:
        findAllProductsById.filter(p => p.id === product.id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(orderProductsQuantity);

    return order;
  }
}

export default CreateOrderService;
